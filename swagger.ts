import swaggerAutogen from "swagger-autogen";
const PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 4000;

const doc = {
  info: {
    title: "HRMS Backend APIs",
    description: "Auto-generated Swagger Docs",
  },
  host: `localhost:${PORT}`,
  schemes: ["http"],
};

const outputFile = "./swagger-output.json";
const endpointsFiles = ["./src/app.ts"];

swaggerAutogen()(outputFile, endpointsFiles, doc);
