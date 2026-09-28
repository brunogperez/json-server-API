import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

import User from '../models/User.js';
import Reseller from '../models/Reseller.js';
import EndCustomer from '../models/EndCustomer.js';
import Plan from '../models/Plan.js';
import Subscription from '../models/Subscription.js';
import CreditTransaction from '../models/CreditTransaction.js';
import { encryptCredentials } from '../utils/crypto.js';

dotenv.config();

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const seedData = {
  users: [
    { firstName: 'Admin', lastName: 'Owner', email: 'admin@mail.com', password: '123123123', role: 'admin' },
    { firstName: 'Bruno', lastName: 'Perez', email: 'bruno.perez@mail.com', password: '123123123', role: 'admin' }
  ],
  ownerReseller: {
    firstName: 'Owner',
    lastName: 'Direct',
    email: 'owner@local',
    businessName: 'Owner Direct Sales',
    isOwner: true,
    credits: 0,
    active: true
  },
  resellers: [
    {
      firstName: 'Juan', lastName: 'Garcia', email: 'juan.garcia@reseller.com',
      phone: '+541112345678', businessName: 'Garcia Services', credits: 100, active: true
    },
    {
      firstName: 'Maria', lastName: 'Lopez', email: 'maria.lopez@reseller.com',
      phone: '+541198765432', businessName: 'Lopez Digital', credits: 50, active: true
    },
    {
      firstName: 'Pedro', lastName: 'Rodriguez', email: 'pedro.rodriguez@reseller.com',
      phone: '+541155667788', businessName: 'Rodriguez Tech', credits: 0, active: true
    }
  ],
  plans: [
    {
      name: 'IPTV 1 Mes - 1 Pantalla', serviceType: 'IPTV',
      durationDays: 30, capacity: 1, creditCost: 1, ownerPrice: 5, suggestedResellerPrice: 10,
      credentialFields: ['username', 'password', 'serverUrl'],
      description: 'IPTV mensual una pantalla', active: true
    },
    {
      name: 'IPTV 1 Mes - 2 Pantallas', serviceType: 'IPTV',
      durationDays: 30, capacity: 2, creditCost: 2, ownerPrice: 8, suggestedResellerPrice: 15,
      credentialFields: ['username', 'password', 'serverUrl'],
      description: 'IPTV mensual dos pantallas', active: true
    },
    {
      name: 'IPTV 12 Meses - 2 Pantallas', serviceType: 'IPTV',
      durationDays: 365, capacity: 2, creditCost: 18, ownerPrice: 70, suggestedResellerPrice: 140,
      credentialFields: ['username', 'password', 'serverUrl'],
      description: 'IPTV anual dos pantallas', active: true
    },
    {
      name: 'VPN Premium 1 Mes', serviceType: 'VPN',
      durationDays: 30, capacity: 5, creditCost: 2, ownerPrice: 6, suggestedResellerPrice: 12,
      credentialFields: ['username', 'password', 'configUrl'],
      description: 'VPN 5 dispositivos simultáneos', active: true
    },
    {
      name: 'VPN Premium 12 Meses', serviceType: 'VPN',
      durationDays: 365, capacity: 5, creditCost: 20, ownerPrice: 60, suggestedResellerPrice: 120,
      credentialFields: ['username', 'password', 'configUrl'],
      description: 'VPN anual 5 dispositivos', active: true
    },
    {
      name: 'Hosting Starter Mensual', serviceType: 'Hosting',
      durationDays: 30, capacity: 1, creditCost: 3, ownerPrice: 10, suggestedResellerPrice: 20,
      credentialFields: ['controlPanelUrl', 'username', 'password', 'ftpHost'],
      description: 'Hosting básico 10GB', active: true
    }
  ]
};

const seedDatabase = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fenixAPI';
    await mongoose.connect(MONGODB_URI, { dbName: process.env.DB_NAME || 'fenixAPI' });
    console.log('✅ Conectado a MongoDB');

    await Promise.all([
      User.deleteMany({}),
      Reseller.deleteMany({}),
      EndCustomer.deleteMany({}),
      Plan.deleteMany({}),
      Subscription.deleteMany({}),
      CreditTransaction.deleteMany({})
    ]);
    console.log('🧹 Base de datos limpiada');

    const usersHashed = await Promise.all(
      seedData.users.map(async (u) => ({ ...u, password: await bcrypt.hash(u.password, 10) }))
    );
    const users = await User.insertMany(usersHashed);
    const admin = users[0];
    console.log(`👤 ${users.length} usuarios admin insertados`);

    const ownerReseller = await Reseller.create(seedData.ownerReseller);
    console.log(`👑 Owner reseller: ${ownerReseller.email}`);

    const resellers = await Reseller.insertMany(seedData.resellers);
    console.log(`🏪 ${resellers.length} resellers insertados`);

    // Multi-tenancy (Story 19): usuario role='reseller' vinculado a Garcia (resellers[0]).
    // Password en texto plano: User.create dispara el hook pre('save') que lo
    // hashea una vez (insertMany NO lo hace; create SÍ).
    const resellerUser = await User.create({
      firstName: resellers[0].firstName,
      lastName: resellers[0].lastName,
      email: 'reseller.garcia@mail.com',
      password: '123123123',
      role: 'reseller',
      resellerProfile: resellers[0]._id
    });
    console.log(`🔐 Usuario reseller: ${resellerUser.email} → ${resellers[0].businessName}`);

    const initialTxs = resellers
      .filter(r => r.credits > 0)
      .map(r => ({
        reseller: r._id, type: 'topup',
        amount: r.credits, balanceAfter: r.credits,
        note: 'Saldo inicial seed', performedBy: admin._id
      }));
    if (initialTxs.length) await CreditTransaction.insertMany(initialTxs);

    const plans = await Plan.insertMany(seedData.plans);
    console.log(`📦 ${plans.length} planes insertados`);

    const customers = await EndCustomer.insertMany([
      {
        firstName: 'Carlos', lastName: 'Directo', email: 'carlos@cliente.com',
        phone: '+541133334444', reseller: ownerReseller._id, active: true
      },
      {
        firstName: 'Ana', lastName: 'Cliente', email: 'ana@cliente.com',
        phone: '+541144445555', reseller: resellers[0]._id, active: true
      },
      {
        firstName: 'Luis', lastName: 'Suscriptor', email: 'luis@cliente.com',
        phone: '+541155556666', reseller: resellers[0]._id, active: true
      },
      {
        firstName: 'Sofia', lastName: 'Premium', email: 'sofia@cliente.com',
        phone: '+541166667777', reseller: resellers[1]._id, active: true
      }
    ]);
    console.log(`👥 ${customers.length} clientes finales insertados`);

    const planIptv1m = plans[0];
    const planIptv12m = plans[2];
    const planVpn1m = plans[3];
    const planHosting = plans[5];

    const buildSub = (customer, reseller, plan, salePrice, daysAgo, credentials) => {
      const start = addDays(new Date(), -daysAgo);
      return {
        endCustomer: customer._id,
        soldBy: reseller._id,
        plan: plan._id,
        planSnapshot: {
          name: plan.name, serviceType: plan.serviceType,
          durationDays: plan.durationDays, capacity: plan.capacity, creditCost: plan.creditCost
        },
        salePrice,
        startDate: start,
        endDate: addDays(start, plan.durationDays),
        status: 'active',
        // insertMany no dispara pre('save'): ciframos las credenciales acá.
        credentials: encryptCredentials(credentials)
      };
    };

    const subs = await Subscription.insertMany([
      buildSub(customers[0], ownerReseller, planIptv1m, planIptv1m.ownerPrice, 5,
        { username: 'iptv_carlos', password: 'demo123', serverUrl: 'http://iptv.example.com:8080' }),
      buildSub(customers[1], resellers[0], planIptv12m, planIptv12m.suggestedResellerPrice, 10,
        { username: 'iptv_ana', password: 'demo456', serverUrl: 'http://iptv.example.com:8080' }),
      buildSub(customers[2], resellers[0], planVpn1m, planVpn1m.suggestedResellerPrice, 2,
        { username: 'vpn_luis', password: 'demo789', configUrl: 'http://vpn.example.com/config.ovpn' }),
      buildSub(customers[3], resellers[1], planHosting, planHosting.suggestedResellerPrice, 30,
        { controlPanelUrl: 'http://cpanel.example.com', username: 'sofia_host', password: 'demo000', ftpHost: 'ftp.example.com' })
    ]);
    console.log(`📅 ${subs.length} suscripciones insertadas`);

    let garciaBalance = resellers[0].credits;
    let lopezBalance = resellers[1].credits;
    const consumeTxs = [];

    garciaBalance -= planIptv12m.creditCost;
    consumeTxs.push({
      reseller: resellers[0]._id, type: 'consume',
      amount: -planIptv12m.creditCost, balanceAfter: garciaBalance,
      relatedSubscription: subs[1]._id,
      note: `Alta ${planIptv12m.serviceType} - ${planIptv12m.name}`,
      performedBy: admin._id
    });
    garciaBalance -= planVpn1m.creditCost;
    consumeTxs.push({
      reseller: resellers[0]._id, type: 'consume',
      amount: -planVpn1m.creditCost, balanceAfter: garciaBalance,
      relatedSubscription: subs[2]._id,
      note: `Alta ${planVpn1m.serviceType} - ${planVpn1m.name}`,
      performedBy: admin._id
    });
    lopezBalance -= planHosting.creditCost;
    consumeTxs.push({
      reseller: resellers[1]._id, type: 'consume',
      amount: -planHosting.creditCost, balanceAfter: lopezBalance,
      relatedSubscription: subs[3]._id,
      note: `Alta ${planHosting.serviceType} - ${planHosting.name}`,
      performedBy: admin._id
    });
    await CreditTransaction.insertMany(consumeTxs);

    await Reseller.findByIdAndUpdate(resellers[0]._id, { credits: garciaBalance });
    await Reseller.findByIdAndUpdate(resellers[1]._id, { credits: lopezBalance });

    console.log('\n✅ Migración completada');
    console.log('\nCredenciales admin:');
    console.log('  admin@mail.com / 123123123');
    console.log('  bruno.perez@mail.com / 123123123');
    console.log(`\nOwner reseller ID: ${ownerReseller._id}`);
    console.log(`Saldos finales: Garcia=${garciaBalance}, Lopez=${lopezBalance}, Rodriguez=${resellers[2].credits}`);
    console.log(`\nTipos de servicio sembrados: IPTV, VPN, Hosting`);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    process.exit(process.exitCode || 0);
  }
};

seedDatabase();
