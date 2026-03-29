import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

export interface ConnectField {
  key: string;
  label: string;
  required?: boolean;
  secret?: boolean;
  placeholder?: string;
  envVar?: string;
}

interface ConnectModalProps {
  title: string;
  description: string;
  fields: ConnectField[];
  initialValues: Record<string, string>;
  onSubmit: (values: Record<string, string>) => void | Promise<void>;
  onCancel: () => void;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  title,
  description,
  fields,
  initialValues,
  onSubmit,
  onCancel,
}) => {
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...initialValues }));
  const [index, setIndex] = useState(0);

  const activeField = fields[index];
  const missingRequired = useMemo(
    () => fields.filter((field) => field.required && !values[field.key]?.trim()).map((field) => field.label),
    [fields, values],
  );

  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.upArrow) {
      setIndex((prev) => (prev <= 0 ? fields.length - 1 : prev - 1));
      return;
    }
    if (key.downArrow) {
      setIndex((prev) => (prev + 1) % fields.length);
    }
  });

  const activeValue = activeField ? (values[activeField.key] ?? "") : "";

  return (
    <Box flexDirection="column" marginLeft={2} marginTop={1} borderStyle="round" borderColor="green" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="green">{title}</Text>
        <Text dimColor>esc</Text>
      </Box>
      <Text dimColor>{description}</Text>
      <Box flexDirection="column" marginTop={1}>
        {fields.map((field, fieldIndex) => {
          const active = fieldIndex === index;
          const value = values[field.key] ?? "";
          const visibleValue = field.secret && value ? "*".repeat(Math.min(value.length, 12)) : value;
          return (
            <Box key={field.key} flexDirection="column">
              <Text color={active ? "black" : "white"} backgroundColor={active ? "green" : undefined}>
                {active ? "❯ " : "  "}
                {field.label}{field.required ? " *" : ""}: {visibleValue || "<empty>"}
              </Text>
              {field.envVar && (
                <Box marginLeft={4}>
                  <Text dimColor>{field.envVar}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
      {activeField && (
        <Box marginTop={1}>
          <Text color="cyan">{activeField.label} </Text>
          <TextInput
            value={activeValue}
            onChange={(next) => setValues((prev) => ({ ...prev, [activeField.key]: next }))}
            onSubmit={async () => {
              if (index < fields.length - 1) {
                setIndex(index + 1);
                return;
              }
              if (missingRequired.length > 0) {
                return;
              }
              await onSubmit(values);
            }}
            placeholder={activeField.placeholder ?? ""}
          />
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>enter next/save · ↑/↓ switch field</Text>
      </Box>
      {missingRequired.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text color="yellow">Missing required:</Text>
          {missingRequired.map((item) => (
            <Text key={item} dimColor>  {item}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
};
