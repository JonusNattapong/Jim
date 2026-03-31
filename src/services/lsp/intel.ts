import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface SymbolInfo {
  name: string;
  kind: string;
  line: number;
  containerName?: string;
}

export class CodeIntelService {
  constructor(private projectRoot: string) {}

  /**
   * Get all symbols in a file using a lightweight regex-based approach 
   * (Parity with LSP 'documentSymbol')
   */
  async getSymbols(filePath: string): Promise<SymbolInfo[]> {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const symbols: SymbolInfo[] = [];

    // Regex for basic TS/JS symbols
    const patterns = [
      { reg: /export\s+(?:class|interface|type|enum)\s+([a-zA-Z0-9_]+)/g, kind: "Class/Interface" },
      { reg: /(?:public|private|protected|static|async)?\s*([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(?::|{)/g, kind: "Method/Function" },
      { reg: /(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=/g, kind: "Variable" },
    ];

    lines.forEach((line, index) => {
      for (const p of patterns) {
        let match;
        // Reset lastIndex for global regex
        p.reg.lastIndex = 0;
        if ((match = p.reg.exec(line)) !== null) {
          symbols.push({
            name: match[1],
            kind: p.kind,
            line: index + 1
          });
        }
      }
    });

    return symbols;
  }

  /**
   * Find definitions using ripgrep (Parity with LSP 'definition')
   */
  async findDefinitions(symbolName: string): Promise<any[]> {
    // Search for export/class/function definitions
    const { stdout } = await execAsync(`rg -n --column "export\\s+(class|interface|type|enum|const|let|var|function|async\\s+function)\\s+${symbolName}\\b"`, { cwd: this.projectRoot });
    return this.parseRgOutput(stdout);
  }

  /**
   * Find references using ripgrep (Parity with LSP 'references')
   */
  async findReferences(symbolName: string): Promise<any[]> {
    const { stdout } = await execAsync(`rg -n --column "\\b${symbolName}\\b"`, { cwd: this.projectRoot });
    return this.parseRgOutput(stdout);
  }

  private parseRgOutput(output: string): any[] {
    if (!output) return [];
    return output.trim().split("\n").map(line => {
      const parts = line.split(":");
      if (parts.length < 3) return null;
      return {
        file: parts[0],
        line: parseInt(parts[1]),
        column: parseInt(parts[2]),
        preview: parts.slice(3).join(":").trim()
      };
    }).filter(Boolean);
  }
}
