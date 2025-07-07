declare module "ascii-table" {
  class AsciiTable {
    constructor();
    setHeading(...headings: string[]): this;
    addRow(...rows: any[]): this;
    toString(): string;
  }

  export = AsciiTable;
}
