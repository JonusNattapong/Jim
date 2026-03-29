import React from "react";
import { render, Box } from "ink";
import { MarkdownText } from "../cli/components/MarkdownText.js";

const testMarkdown = `
# Table Test

Here is a comparison table:

| Language | Type    | Speed | Use Case         |
|----------|---------|-------|------------------|
| Python   | Dynamic | Slow  | AI/ML, Scripting |
| Rust     | Static  | Fast  | Systems, CLI     |
| Go       | Static  | Fast  | Backend, DevOps  |
| TypeScript | Static | Med  | Web, Full-stack  |

And some other elements:

## Code Block

\`\`\`typescript
const greeting = "Hello from Jim!";
console.log(greeting);
\`\`\`

## List
- First item with **bold**
- Second item with \`inline code\`
- Third item

> This is a blockquote for testing

Done!
`;

const App = () => (
  <Box flexDirection="column" padding={1}>
    <MarkdownText>{testMarkdown}</MarkdownText>
  </Box>
);

render(<App />);

setTimeout(() => process.exit(0), 2000);
