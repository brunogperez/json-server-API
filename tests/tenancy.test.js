import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Reseller from '../src/models/Reseller.js';
import EndCustomer from '../src/models/EndCustomer.js';
import { connectTestDb, disconnectTestDb } from './helpers/db.js';

const PASSWORD = 'secret123';

// Crea un reseller con su usuario vinculado y un cliente final propio.
const createTenant = async (slug) => {
  const reseller = await Reseller.create({ firstName: slug, lastName: 'Tenant', email: `${slug}@reseller.com` });
  await User.create({
    firstName: slug, lastName: 'Tenant', email: `${slug}@user.com`,
    password: PASSWORD, role: 'reseller', resellerProfile: reseller._id
  });
  const customer = await EndCustomer.create({ firstName: `Cliente ${slug}`, lastName: 'Final', reseller: reseller._id });
  const { body } = await request(app).post('/api/users/login').send({ email: `${slug}@user.com`, password: PASSWORD });
  return { reseller, customer, token: body.token, userId: body.id };
};

let alpha;
let beta;

beforeAll(async () => {
  await connectTestDb('tenancy');
  alpha = await createTenant('alpha');
  beta = await createTenant('beta');
});
afterAll(() => disconnectTestDb());

describe('Aislamiento entre revendedores', () => {
  it('un reseller sólo lista sus propios clientes finales', async () => {
    const res = await request(app)
      .get('/api/end-customers')
      .set('Authorization', `Bearer ${alpha.token}`);

    expect(res.status).toBe(200);
    expect(res.body.map((c) => c._id)).toEqual([String(alpha.customer._id)]);
  });

  it('el filtro ?reseller= no permite leer clientes de otro reseller', async () => {
    const res = await request(app)
      .get(`/api/end-customers?reseller=${beta.reseller._id}`)
      .set('Authorization', `Bearer ${alpha.token}`);

    expect(res.body.map((c) => c._id)).toEqual([String(alpha.customer._id)]);
  });

  it('un reseller no puede ver el detalle de un cliente ajeno', async () => {
    const res = await request(app)
      .get(`/api/end-customers/${beta.customer._id}`)
      .set('Authorization', `Bearer ${alpha.token}`);

    expect(res.status).toBe(403);
  });

  it('un reseller no puede re-vincularse a otro reseller editando su usuario', async () => {
    await request(app)
      .patch(`/api/users/${alpha.userId}`)
      .set('Authorization', `Bearer ${alpha.token}`)
      .send({ resellerProfile: String(beta.reseller._id) });

    const res = await request(app)
      .get('/api/end-customers')
      .set('Authorization', `Bearer ${alpha.token}`);
    expect(res.body.map((c) => c._id)).toEqual([String(alpha.customer._id)]);
  });
});
