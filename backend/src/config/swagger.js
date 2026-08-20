import swaggerJSDoc from 'swagger-jsdoc';
import env from './env.js';

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Marka AI API',
      version: '1.0.0',
      description: 'API Documentation for Marka Platform',
    },
    servers: [{ url: `http://localhost:${env.PORT}/api/v1` }],
  },
  apis: ['./src/routes/*.js'],
});

export default swaggerSpec;
