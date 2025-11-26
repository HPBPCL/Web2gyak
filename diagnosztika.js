const mysql = require('mysql2');


const config = {
    host: '127.0.0.1',  
    user: 'studb130',   
    password: 'abc123',  
    database: 'db130',   
    connectTimeout: 5000 
};

console.log("---ADATBÁZIS DIAGNOSZTIKA ---");
console.log(`Próbálkozás ezzel: ${config.user}@${config.host} -> ${config.database}`);

const connection = mysql.createConnection(config);

connection.connect((err) => {
    if (err) {
        console.error("\n❌ HIBA TÖRTÉNT!");
        console.error(`Hibakód: ${err.code}`);
        console.error(`Üzenet: ${err.message}`);
        
        if (err.code === 'ECONNREFUSED') {
            console.log("\nELEMZÉS: A szerver nem engedi a kapcsolatot a 127.0.0.1 címen.");
            console.log("JAVASLAT: Próbáld átírni a host-ot 'localhost'-ra az indito.js-ben!");
        } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log("\nELEMZÉS: Hibás felhasználónév vagy jelszó!");
            console.log("JAVASLAT: Biztos, hogy 'abc123' a jelszó? Nem írtad át véletlenül?");
        } else if (err.code === 'ER_BAD_DB_ERROR') {
            console.log("\nELEMZÉS: Nem létezik ilyen nevű adatbázis!");
            console.log("JAVASLAT: Ellenőrizd a HeidiSQL-ben a pontos nevet (db130?).");
        }
    } else {
        console.log("\n✅ SIKER! A kapcsolat tökéletesen működik.");
        console.log("Ha ezt látod, akkor az indito.js-ben van elírás, nem a szerverben.");
        connection.end();
    }
});