/**
 * NotebookEdit Tool for Jim
 * Edit Jupyter notebooks (.ipynb files)
 */

import type { ToolDefinition, ToolHandler } from "./types.js";
import fs from "fs/promises";

export const notebook_edit_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "notebook_edit",
    description:
      "Edit Jupyter notebook cells. Use this to read, modify, add, or delete cells in .ipynb files.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the .ipynb file",
        },
        action: {
          type: "string",
          enum: ["read", "edit", "add", "delete"],
          description: "Action to perform on the notebook",
        },
        cellIndex: {
          type: "number",
          description: "Index of the cell to edit or delete (0-based)",
        },
        cellType: {
          type: "string",
          enum: ["code", "markdown"],
          description: "Type of cell to add (for 'add' action)",
        },
        source: {
          type: "string",
          description: "New source code/content for the cell",
        },
      },
      required: ["path", "action"],
    },
  },
};

export const notebook_edit_handler: ToolHandler = async (
  args: any,
  context,
) => {
  const filePath = args.path as string;
  const action = args.action as string;
  const cellIndex = args.cellIndex as number | undefined;
  const cellType = (args.cellType as string) || "code";
  const source = args.source as string | undefined;

  if (!filePath.endsWith(".ipynb")) {
    return {
      content: "Error: File must be a .ipynb notebook file.",
      isError: true,
    };
  }

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const notebook = JSON.parse(content);

    if (!notebook.cells) {
      return {
        content: "Error: Invalid notebook format.",
        isError: true,
      };
    }

    switch (action) {
      case "read": {
        const cells = notebook.cells.map((cell: any, idx: number) => {
          const cellSource = Array.isArray(cell.source)
            ? cell.source.join("")
            : cell.source;
          return `[${idx}] (${cell.cell_type})\n${cellSource}\n`;
        });
        return {
          content: `Notebook: ${filePath} (${notebook.cells.length} cells)\n\n${cells.join("\n---\n\n")}`,
        };
      }

      case "edit": {
        if (cellIndex === undefined) {
          return {
            content: "Error: 'cellIndex' is required for edit action.",
            isError: true,
          };
        }
        if (source === undefined) {
          return {
            content: "Error: 'source' is required for edit action.",
            isError: true,
          };
        }
        if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
          return {
            content: `Error: Cell index ${cellIndex} out of range (0-${notebook.cells.length - 1}).`,
            isError: true,
          };
        }
        notebook.cells[cellIndex].source = source
          .split("\n")
          .map((line: string, i: number, arr: string[]) =>
            i < arr.length - 1 ? line + "\n" : line,
          );
        await fs.writeFile(filePath, JSON.stringify(notebook, null, 1));
        return { content: `✅ Edited cell ${cellIndex} in ${filePath}` };
      }

      case "add": {
        if (source === undefined) {
          return {
            content: "Error: 'source' is required for add action.",
            isError: true,
          };
        }
        const newCell: any = {
          cell_type: cellType,
          source: source
            .split("\n")
            .map((line: string, i: number, arr: string[]) =>
              i < arr.length - 1 ? line + "\n" : line,
            ),
          metadata: {},
        };
        if (cellType === "code") {
          newCell.execution_count = null;
          newCell.outputs = [];
        }
        if (
          cellIndex !== undefined &&
          cellIndex >= 0 &&
          cellIndex <= notebook.cells.length
        ) {
          notebook.cells.splice(cellIndex, 0, newCell);
        } else {
          notebook.cells.push(newCell);
        }
        await fs.writeFile(filePath, JSON.stringify(notebook, null, 1));
        return { content: `✅ Added ${cellType} cell to ${filePath}` };
      }

      case "delete": {
        if (cellIndex === undefined) {
          return {
            content: "Error: 'cellIndex' is required for delete action.",
            isError: true,
          };
        }
        if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
          return {
            content: `Error: Cell index ${cellIndex} out of range (0-${notebook.cells.length - 1}).`,
            isError: true,
          };
        }
        notebook.cells.splice(cellIndex, 1);
        await fs.writeFile(filePath, JSON.stringify(notebook, null, 1));
        return { content: `✅ Deleted cell ${cellIndex} from ${filePath}` };
      }

      default:
        return {
          content: `Error: Unknown action: ${action}. Use: read, edit, add, delete`,
          isError: true,
        };
    }
  } catch (err: any) {
    return {
      content: `NotebookEdit failed: ${err.message}`,
      isError: true,
    };
  }
};
