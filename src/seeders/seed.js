import mongoose from 'mongoose';
import User from '../models/User.js';
import Client from '../models/Client.js';
import Product from '../models/Product.js';
import Inscription from '../models/Inscription.js';
import dotenv from 'dotenv';

dotenv.config();

// Datos del db.json original
const seedData = {
  users: [
    {
      firstName: "Paula",
      lastName: "Martinez",
      email: "paulamartinez@mail.com",
      password: "123123123",
      role: "admin"
    },
    {
      firstName: "Test",
      lastName: "Test",
      email: "test@test.com",
      password: "123123123",
      role: "user"
    },
    {
      firstName: "Admin",
      lastName: "Admin",
      email: "admin@mail.com",
      password: "123123123",
      role: "admin"
    },
    {
      firstName: "Bruno",
      lastName: "Perez",
      email: "bruno.perez@mail.com",
      password: "123123123",
      role: "admin"
    }
  ],
  clients: [
    {
      firstName: "Sharla",
      lastName: "Dicka",
      email: "sdick0@unblog.fr",
      birthdate: "1995-10-27T12:45:01Z"
    },
    {
      firstName: "Melly",
      lastName: "Bauckham",
      email: "mbauckham2@mozilla.org",
      birthdate: "1993-08-22T08:30:15Z"
    },
    {
      firstName: "Benny",
      lastName: "Nieass",
      email: "bnieass3@theatlantic.com",
      birthdate: "2003-05-30T05:09:23Z"
    },
    {
      firstName: "Bruno",
      lastName: "Perez",
      email: "brunogperez@mail.com",
      birthdate: "1991-10-24T02:00:00.000Z"
    }
  ],
  products: [
    {
      name: "Web Development",
      duration: "5 months",
      level: "Intermediate",
      description: "Learn to build websites from scratch, mastering HTML, CSS, and JavaScript to create interactive and responsive pages.",
      classes: [
        {
          name: "Introduction to Web Development",
          date: "2024-01-01T00:00:00.000Z"
        },
        {
          name: "HTML Basics",
          date: "2024-01-03T00:00:00.000Z"
        },
        {
          name: "CSS Fundamentals",
          date: "2024-01-05T00:00:00.000Z"
        },
        {
          name: "JavaScript for Beginners",
          date: "2024-01-07T00:00:00.000Z"
        }
      ]
    },
    {
      name: "JavaScript",
      duration: "2 months",
      level: "Intermediate",
      description: "Master JavaScript to add interactivity to your web projects and build client-side dynamic applications.",
      classes: [
        {
          name: "Introduction to JavaScript",
          date: "2024-02-01T00:00:00.000Z"
        },
        {
          name: "Variables and Functions",
          date: "2024-02-03T00:00:00.000Z"
        },
        {
          name: "DOM Manipulation",
          date: "2024-02-05T00:00:00.000Z"
        },
        {
          name: "Advanced JavaScript",
          date: "2024-02-07T00:00:00.000Z"
        }
      ]
    },
    {
      name: "ReactJS",
      duration: "2 months",
      level: "Intermediate",
      description: "Learn the fundamentals of ReactJS to build modern and efficient user interfaces with reusable components.",
      classes: [
        {
          name: "React Basics",
          date: "2024-03-01T00:00:00.000Z"
        },
        {
          name: "Components and Props",
          date: "2024-03-03T00:00:00.000Z"
        },
        {
          name: "State and Lifecycle",
          date: "2024-03-05T00:00:00.000Z"
        },
        {
          name: "Hooks in React",
          date: "2024-03-07T00:00:00.000Z"
        }
      ]
    },
    {
      name: "Python",
      duration: "2 months",
      level: "Beginner",
      description: "Discover the versatility of Python, a powerful language for automation, data analysis, and software development.",
      classes: [
        {
          name: "Introduction to Python",
          date: "2024-05-01T00:00:00.000Z"
        },
        {
          name: "Data Types and Variables",
          date: "2024-05-03T00:00:00.000Z"
        },
        {
          name: "Control Structures",
          date: "2024-05-05T00:00:00.000Z"
        },
        {
          name: "Functions in Python",
          date: "2024-05-07T00:00:00.000Z"
        }
      ]
    },
    {
      name: "Angular",
      duration: "3 months",
      level: "Intermediate",
      description: "Learn to build powerful and scalable web applications using Angular, one of the most popular front-end frameworks.",
      classes: [
        {
          name: "Introducción y configuración de herramientas",
          date: "2024-09-09T00:00:00.000Z"
        },
        {
          name: "Componentes y Elementos de un proyecto Angular",
          date: "2024-09-11T00:00:00.000Z"
        },
        {
          name: "Typescript",
          date: "2024-09-16T00:00:00.000Z"
        },
        {
          name: "Interpolación y Directivas",
          date: "2024-09-18T00:00:00.000Z"
        }
      ]
    }
  ]
};

const seedDatabase = async () => {
  try {
    // Conectar a MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fenixAPI';
    await mongoose.connect(MONGODB_URI, {
      dbName: 'fenixAPI'
    });
    console.log('Conectado a MongoDB - Base de datos: fenixAPI');

    // Limpiar la base de datos
    await User.deleteMany({});
    await Client.deleteMany({});
    await Product.deleteMany({});
    await Inscription.deleteMany({});
    console.log('Base de datos limpiada');

    // Insertar usuarios
    const users = await User.insertMany(seedData.users);
    console.log(`${users.length} usuarios insertados`);

    // Insertar clientes
    const clients = await Client.insertMany(seedData.clients);
    console.log(`${clients.length} clientes insertados`);

    // Insertar productos
    const products = await Product.insertMany(seedData.products);
    console.log(`${products.length} productos insertados`);

    // Crear algunas inscripciones de ejemplo
    const sampleInscriptions = [
      {
        client: clients[0]._id,
        product: products[0]._id,
        status: 'active',
        progress: 25
      },
      {
        client: clients[1]._id,
        product: products[1]._id,
        status: 'active',
        progress: 75
      },
      {
        client: clients[2]._id,
        product: products[2]._id,
        status: 'completed',
        progress: 100,
        completionDate: new Date()
      },
      {
        client: clients[3]._id,
        product: products[3]._id,
        status: 'active',
        progress: 50
      }
    ];

    const inscriptions = await Inscription.insertMany(sampleInscriptions);
    console.log(`${inscriptions.length} inscripciones insertadas`);

    console.log('✅ Migración completada exitosamente');
    console.log('\nCredenciales de prueba:');
    console.log('Admin: admin@mail.com / 123123123');
    console.log('Usuario: test@test.com / 123123123');
    
  } catch (error) {
    console.error('❌ Error en la migración:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

seedDatabase();