declare module 'ascii-table' {
    class AsciiTable {
        constructor();
        setHeading(...headings: string[]): this;
        addRow(...rows: string[]): this;
        toString(): string;
    }

    export = AsciiTable
}