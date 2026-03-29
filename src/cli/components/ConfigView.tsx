import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface ConfigItem {
  key: string;
  label: string;
  value: any;
  type: "string" | "boolean" | "number" | "enum";
  options?: string[];
  description?: string;
}

interface ConfigViewProps {
  config: ConfigItem[];
  onClose: () => void;
  onUpdate: (key: string, value: any) => void;
}

export const ConfigView: React.FC<ConfigViewProps> = ({ config, onClose, onUpdate }) => {
  const [tab, setTab] = useState<"Settings" | "Status" | "Usage">("Settings");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [search, setSearch] = useState("");

  const filteredItems = config.filter(item => 
    item.label.toLowerCase().includes(search.toLowerCase()) || 
    item.key.toLowerCase().includes(search.toLowerCase())
  );

  useInput((input, key) => {
    if (key.escape) onClose();
    if (key.tab || key.rightArrow || key.leftArrow) {
        if (input === "" || key.tab) {
            setTab(prev => {
                if (prev === "Settings") return "Status";
                if (prev === "Status") return "Usage";
                return "Settings";
            });
            setSelectedIndex(0);
        }
    }
    if (key.upArrow) setSelectedIndex(i => Math.max(0, i - 1));
    if (key.downArrow) setSelectedIndex(i => Math.min(filteredItems.length - 1, i + 1));
    
    if (key.return) {
      const item = filteredItems[selectedIndex];
      if (item) {
        if (item.type === "boolean") {
          onUpdate(item.key, !item.value);
        } else if (item.type === "enum" && item.options) {
          const curIdx = item.options.indexOf(item.value);
          const nextIdx = (curIdx + 1) % item.options.length;
          onUpdate(item.key, item.options[nextIdx]);
        }
      }
    }

    // Capture search text
    if (!key.ctrl && !key.meta && !key.escape && !key.return && !key.upArrow && !key.downArrow && !key.leftArrow && !key.rightArrow && !key.tab && !key.backspace && !key.delete) {
        setSearch(prev => prev + input);
    }
    if (key.backspace) setSearch(prev => prev.slice(0, -1));
  });

  return (
    <Box flexDirection="column" padding={1} borderStyle="single" borderColor="greenBright">
      <Box marginBottom={1}>
        {["Settings", "Status", "Usage"].map(t => (
            <Box key={t} marginRight={2} paddingX={1} backgroundColor={tab === t ? "greenBright" : undefined}>
                <Text bold color={tab === t ? "black" : "gray"}>{t}</Text>
            </Box>
        ))}
        <Text dimColor>(←/→ or tab to cycle)</Text>
      </Box>

      <Box marginBottom={1}>
        <Text italic dimColor>Configure Jim preferences</Text>
      </Box>

      <Box borderStyle="round" borderColor="white" paddingX={1} marginBottom={1}>
        <Text dimColor>⌕ </Text>
        <Text color="white">{search}</Text>
        {search === "" && <Text dimColor italic>Search settings...</Text>}
      </Box>

      {tab === "Settings" ? (
        <Box flexDirection="column">
          {filteredItems.map((item, i) => {
            const isSelected = i === selectedIndex;
            let displayValue = String(item.value);
            let valueColor = "white";
            
            if (item.type === "boolean") {
              valueColor = item.value ? "green" : "red";
              displayValue = item.value ? "true" : "false";
            } else if (item.type === "enum") {
              valueColor = "greenBright";
            }

            return (
              <Box key={item.key}>
                <Text color="greenBright">{isSelected ? "> " : "  "}</Text>
                <Box width={40}>
                  <Text bold={isSelected} color={isSelected ? "white" : "gray"}>
                    {item.label}
                  </Text>
                </Box>
                <Text color={valueColor}>{displayValue}</Text>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box flexDirection="column">
            <Text>System {tab} information will go here...</Text>
        </Box>
      )}

      <Box marginTop={1} paddingTop={1} borderTop borderStyle="single" borderColor="gray">
        <Text dimColor>Type to filter  ·  Enter/↓ to select  ·  Esc to clear/close</Text>
      </Box>
    </Box>
  );
};
