// Crée la base application_image (si besoin) puis exécute sql/application_image.sql.
// Usage : npm run init-db   (mêmes variables d'environnement que le serveur)
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { config } = require("../db");

async function main() {
    // 1. Connexion à la base « postgres » pour créer application_image
    const admin = new Client({ ...config, database: "postgres" });
    await admin.connect();
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [config.database]);
    if (rowCount === 0) {
        await admin.query(`CREATE DATABASE "${config.database.replace(/"/g, '""')}"`);
        console.log(`Base ${config.database} créée.`);
    }
    await admin.end();

    // 2. Tables et données
    const client = new Client(config);
    await client.connect();
    await client.query("SET client_min_messages TO WARNING");
    await client.query(fs.readFileSync(path.join(__dirname, "..", "sql", "application_image.sql"), "utf8"));
    const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM images");
    await client.end();
    console.log(`Tables créées, ${rows[0].n} images insérées. Lancez maintenant : npm start`);
}

main().catch(err => {
    console.error("Échec de l'initialisation :", err.message);
    if (err.code === "ECONNREFUSED") console.error("PostgreSQL ne semble pas lancé sur", `${config.host}:${config.port}`);
    if (err.code === "28P01") console.error("Mot de passe refusé : définissez PGPASSWORD (voir le README).");
    process.exit(1);
});
