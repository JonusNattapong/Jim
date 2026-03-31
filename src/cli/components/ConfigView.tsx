import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "../theme.js";

interface ConfigItem {
  key: string;
  label: string;
  value: any;
  type: "string" | "boolean" | "number" | "enum";
  options?: string[];
  description?: string;
}

interface StatusInfo {
  nodeVersion: string;
  platform: string;
  uptime: string;
  memoryMb: number;
  projectRoot: string;
  provider: string;
  adapter: string;
}

interface UsageInfo {
  tokens: number;
  messages: number;
  turns: number;
  sessionDuration: string;
  model: string;
}

interface ConfigViewProps {
  config: ConfigItem[];
  onClose: () => void;
  onUpdate: (key: string, value: any) => void;
  status?: StatusInfo;
  usage?: UsageInfo;
}

export const ConfigView: React.FC<ConfigViewProps> = ({ config, onClose, onUpdate, status, usage }) => {
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
    <Box flexDirection="column" padding={1} borderStyle="single" borderColor={theme.primary}>
      <Box marginBottom={1}>
        {["Settings", "Status", "Usage"].map(t => (
            <Box key={t} marginRight={2} paddingX={1} backgroundColor={tab === t ? theme.primary : undefined}>
                <Text bold color={tab === t ? theme.inverse : theme.border}>{t}</Text>
            </Box>
        ))}
        <Text dimColor>(←/→ or tab to cycle)</Text>
      </Box>

      <Box marginBottom={1}>
        <Text italic dimColor>Configure Jim preferences</Text>
      </Box>

      <Box borderStyle="round" borderColor={theme.text} paddingX={1} marginBottom={1}>
        <Text dimColor>⌕ </Text>
        <Text color={theme.text}>{search}</Text>
        {search === "" && <Text dimColor italic>Search settings...</Text>}
      </Box>

      {tab === "Settings" ? (
        <Box flexDirection="column">
          {filteredItems.map((item, i) => {
            const isSelected = i === selectedIndex;
            let displayValue = String(item.value);
            let valueColor = theme.text;
            
            if (item.type === "boolean") {
              valueColor = item.value ? theme.success : theme.error;
              displayValue = item.value ? "true" : "false";
            } else if (item.type === "enum") {
              valueColor = theme.primary;
            }

            return (
              <Box key={item.key}>
                <Text color={theme.primary}>{isSelected ? "> " : "  "}</Text>
                <Box width={40}>
                  <Text bold={isSelected} color={isSelected ? theme.text : theme.border}>
                    {item.label}
                  </Text>
                </Box>
                <Text color={valueColor}>{displayValue}</Text>
              </Box>
            );
          })}
        </Box>
      ) : tab === "Status" ? (
        <Box flexDirection="column">
          {status ? (
            <>
              <Box>
                <Box width={20}><Text dimColor>Node.js</Text></Box>
                <Text color={theme.text}>{status.nodeVersion}</Text>
              </Box>
              <Box>
                <Box width={20}><Text dimColor>Platform</Text></Box>
                <Text color={theme.text}>{status.platform}</Text>
              </Box>
              <Box>
                <Box width={20}><Text dimColor>Uptime</Text></Box>
                <Text color={theme.text}>{status.uptime}</Text>
              </Box>
              <Box>
                <Box width={20}><Text dimColor>Memory</Text></Box>
                <Text color={theme.text}>{status.memoryMb} MB</Text>
              </Box>
              <Box>
                <Box width={20}><Text dimColor>Provider</Text></Box>
                <Text color={theme.primary}>{status.provider}</Text>
              </Box>
              <Box>
                <Box width={20}><Text dimColor>Adapter</Text></Box>
                <Text color={theme.primary}>{status.adapter}</Text>
              </Box>
              <Box marginTop={1}>
                <Box width={20}><Text dimColor>Project</Text></Box>
                <Text color={theme.secondary}>{status.projectRoot}</Text>
              </Box>
            </>
          ) : (
            <Text dimColor>No status data available</Text>
          )}
        </Box>
      ) : (
        <Box flexDirection="column">
          {usage ? (
            <>
              <Box>
                <Box width={20}><Text dimColor>Model</Text></Box>
                <Text color={theme.primary}>{usage.model}</Text>
              </Box>
              <Box>
                <Box width={20}><Text dimColor>Tokens used</Text></Box>
                <Text color={usage.tokens > 100000 ? theme.warning : theme.text}>
                  {usage.tokens.toLocaleString()}
                </Text>
              </Box>
              <Box>
                <Box width={20}><Text dimColor>Messages</Text></Box>
                <Text color={theme.text}>{usage.messages}</Text>
              </Box>
              <Box>
                <Box width={20}><Text dimColor>Turns</Text></Box>
                <Text color={theme.text}>{usage.turns}</Text>
              </Box>
              <Box>
                <Box width={20}><Text dimColor>Session time</Text></Box>
                <Text color={theme.text}>{usage.sessionDuration}</Text>
              </Box>
              <Box marginTop={1}>
                <Box width={20}><Text dimColor>Est. cost</Text></Box>
                <Text color={theme.secondary}>~${((usage.tokens / 1_000_000) * 3.00).toFixed(4)}</Text>
              </Box>
            </>
          ) : (
            <Text dimColor>No usage data available</Text>
          )}
        </Box>
      )}

      <Box marginTop={1} paddingTop={1} borderTop borderStyle="single" borderColor={theme.border}>
        <Text dimColor>Type to filter  ·  Enter/↓ to select  ·  Esc to clear/close</Text>
      </Box>
    </Box>
  );
};
