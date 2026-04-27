export const id = 434;
export const ids = [434];
export const modules = {

/***/ 63434:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  migrate: () => (/* binding */ migrate)
});

// EXTERNAL MODULE: external "node:crypto"
var external_node_crypto_ = __webpack_require__(77598);
// EXTERNAL MODULE: external "node:fs"
var external_node_fs_ = __webpack_require__(73024);
;// CONCATENATED MODULE: ./node_modules/drizzle-orm/migrator.js


function readMigrationFiles(config) {
  const migrationFolderTo = config.migrationsFolder;
  const migrationQueries = [];
  const journalPath = `${migrationFolderTo}/meta/_journal.json`;
  if (!external_node_fs_.existsSync(journalPath)) {
    throw new Error(`Can't find meta/_journal.json file`);
  }
  const journalAsString = external_node_fs_.readFileSync(`${migrationFolderTo}/meta/_journal.json`).toString();
  const journal = JSON.parse(journalAsString);
  for (const journalEntry of journal.entries) {
    const migrationPath = `${migrationFolderTo}/${journalEntry.tag}.sql`;
    try {
      const query = external_node_fs_.readFileSync(`${migrationFolderTo}/${journalEntry.tag}.sql`).toString();
      const result = query.split("--> statement-breakpoint").map((it) => {
        return it;
      });
      migrationQueries.push({
        sql: result,
        bps: journalEntry.breakpoints,
        folderMillis: journalEntry.when,
        hash: external_node_crypto_.createHash("sha256").update(query).digest("hex")
      });
    } catch {
      throw new Error(`No file ${migrationPath} found in ${migrationFolderTo} folder`);
    }
  }
  return migrationQueries;
}

//# sourceMappingURL=migrator.js.map
;// CONCATENATED MODULE: ./node_modules/drizzle-orm/better-sqlite3/migrator.js

function migrate(db, config) {
  const migrations = readMigrationFiles(config);
  db.dialect.migrate(migrations, db.session, config);
}

//# sourceMappingURL=migrator.js.map

/***/ })

};
