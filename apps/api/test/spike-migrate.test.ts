import { describe, expect, it } from "vitest";
import { parseMigration } from "../src/spike/migrate.js";

describe("parseMigration", () => {
  it("separa las secciones up y down", () => {
    const sql = "-- up\nCREATE TABLE a (id int);\n\n-- down\nDROP TABLE a;\n";
    expect(parseMigration(sql)).toEqual({
      up: "CREATE TABLE a (id int);",
      down: "DROP TABLE a;",
    });
  });

  it("acepta saltos de línea de Windows", () => {
    const sql = "-- up\r\nCREATE TABLE a (id int);\r\n\r\n-- down\r\nDROP TABLE a;\r\n";
    expect(parseMigration(sql)).toEqual({
      up: "CREATE TABLE a (id int);",
      down: "DROP TABLE a;",
    });
  });

  it("falla si falta la sección down", () => {
    expect(() => parseMigration("-- up\nSELECT 1;\n")).toThrow("-- down");
  });
});
