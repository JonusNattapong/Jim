import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { SessionManager, SessionData } from "../../context/sessions.js";
import { getTokenCounter } from "../../context/tokens.js";

interface StatsData {
  totalTokens: number;
  sessionsCount: number;
  activeDays: number;
  longestSession: number; // ms
  longestStreak: number;
  currentStreak: number;
  favoriteModel: string;
  mostActiveDay: string;
  dailyActivity: Record<string, number>; // "YYYY-MM-DD" -> messageCount
  modelUsage: Record<string, number>;    // modelName -> tokenCount
}

interface StatsViewProps {
  projectRoot: string;
  onClose: () => void;
}

export const StatsView: React.FC<StatsViewProps> = ({ projectRoot, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StatsData | null>(null);
  const [tab, setTab] = useState<"Overview" | "Models">("Overview");

  useInput((input, key) => {
    if (key.escape || input === "q") onClose();
    if (key.tab || key.rightArrow || key.leftArrow) {
      setTab(prev => prev === "Overview" ? "Models" : "Overview");
    }
  });

  useEffect(() => {
    const scan = async () => {
      const manager = new SessionManager(projectRoot);
      const counter = getTokenCounter();
      const sessionList = await manager.list();
      
      let totalTokens = 0;
      const dailyActivity: Record<string, number> = {};
      const modelUsage: Record<string, number> = {};
      const activeDaysSet = new Set<string>();
      let maxDuration = 0;
      const modelCounts: Record<string, number> = {};

      for (const sInfo of sessionList) {
        const session = await manager.load(sInfo.id);
        if (!session) continue;

        const dateKey = new Date(session.createdAt).toISOString().split("T")[0];
        activeDaysSet.add(dateKey);
        
        const msgCount = session.messages.length;
        dailyActivity[dateKey] = (dailyActivity[dateKey] || 0) + msgCount;

        const sessionTokens = counter.countMessages(session.messages as any);
        totalTokens += sessionTokens;

        modelUsage[session.model] = (modelUsage[session.model] || 0) + sessionTokens;
        modelCounts[session.model] = (modelCounts[session.model] || 0) + 1;

        const duration = new Date(session.updatedAt).getTime() - new Date(session.createdAt).getTime();
        if (duration > maxDuration) maxDuration = duration;
      }

      // Find favorite model
      let favoriteModel = "none";
      let maxModelCount = 0;
      for (const [m, c] of Object.entries(modelCounts)) {
        if (c > maxModelCount) {
          maxModelCount = c;
          favoriteModel = m;
        }
      }

      // Calculate streaks
      const sortedDays = Array.from(activeDaysSet).sort();
      let longestStreak = 0;
      let currentStreak = 0;
      
      if (sortedDays.length > 0) {
        let tempStreak = 1;
        longestStreak = 1;
        
        for (let i = 1; i < sortedDays.length; i++) {
          const prev = new Date(sortedDays[i - 1]);
          const curr = new Date(sortedDays[i]);
          const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 3600 * 24);
          
          if (Math.round(diffDays) === 1) {
            tempStreak++;
          } else {
            tempStreak = 1;
          }
          if (tempStreak > longestStreak) longestStreak = tempStreak;
        }

        // Current streak
        const lastDay = new Date(sortedDays[sortedDays.length - 1]);
        const diffToday = (new Date().getTime() - lastDay.getTime()) / (1000 * 3600 * 24);
        if (Math.round(diffToday) <= 1) {
            let temp = 1;
            for (let i = sortedDays.length - 2; i >= 0; i--) {
                const p = new Date(sortedDays[i]);
                const c = new Date(sortedDays[i+1]);
                if (Math.round((c.getTime() - p.getTime()) / (1000 * 3600 * 24)) === 1) temp++;
                else break;
            }
            currentStreak = temp;
        }
      }

      setData({
        totalTokens,
        sessionsCount: sessionList.length,
        activeDays: activeDaysSet.size,
        longestSession: maxDuration,
        longestStreak,
        currentStreak,
        favoriteModel,
        mostActiveDay: sortedDays[sortedDays.length - 1] || "N/A",
        dailyActivity,
        modelUsage
      });
      setLoading(false);
    };

    scan();
  }, [projectRoot]);

  if (loading) {
    return (
      <Box padding={1}>
        <Text color="yellow">Scanning sessions and computing stats...</Text>
      </Box>
    );
  }

  if (!data) return null;

  const renderHeatmap = () => {
    const today = new Date();
    const dots = [];
    // Show last 20 weeks
    for (let i = 0; i < 7; i++) {
        const row = [];
        for (let j = 140; j >= 0; j -= 7) {
            const d = new Date(today);
            d.setDate(today.getDate() - (j + i));
            const key = d.toISOString().split("T")[0];
            const activity = data.dailyActivity[key] || 0;
            const color = activity > 10 ? "red" : activity > 5 ? "redBright" : activity > 0 ? "white" : "gray";
            const char = activity > 0 ? "■" : "·";
            row.push(<Text key={key} color={color} dimColor={activity === 0}>{char} </Text>);
        }
        dots.push(<Box key={i}>{row}</Box>);
    }
    return <Box flexDirection="column" marginTop={1}>{dots}</Box>;
  };

  const formatDuration = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    if (hr > 0) return `${hr}h ${min % 60}m ${sec % 60}s`;
    return `${min}m ${sec % 60}s`;
  };

  return (
    <Box flexDirection="column" padding={1} borderStyle="single" borderColor="red">
      <Box marginBottom={1}>
        <Box marginRight={2} paddingX={1} backgroundColor={tab === "Overview" ? "red" : undefined}>
          <Text bold color={tab === "Overview" ? "white" : "gray"}>Overview</Text>
        </Box>
        <Box paddingX={1} backgroundColor={tab === "Models" ? "red" : undefined}>
          <Text bold color={tab === "Models" ? "white" : "gray"}>Models</Text>
        </Box>
        <Box marginLeft={2}>
          <Text dimColor>(←/→ or tab to cycle)</Text>
        </Box>
      </Box>

      {tab === "Overview" ? (
        <Box flexDirection="column">
          <Box marginLeft={4} marginBottom={1}>
            <Text dimColor>Apr May Jun Jul Aug Sep Oct Nov Dec Jan Feb Mar</Text>
            {renderHeatmap()}
            <Box marginTop={1}>
                <Text dimColor>Less  · ■ ■ ■  More</Text>
            </Box>
          </Box>

          <Box flexDirection="row" marginBottom={1}>
            <Text color="red" bold>All time</Text>
            <Text dimColor>  ·  Last 7 days  ·  Last 30 days</Text>
          </Box>

          <Box flexDirection="row">
            <Box flexDirection="column" width={40}>
              <Box>
                <Text dimColor>Favorite model: </Text>
                <Text color="greenBright">{data.favoriteModel}</Text>
              </Box>
              <Box marginTop={1}>
                <Text dimColor>Sessions: </Text>
                <Text color="white">{data.sessionsCount}</Text>
              </Box>
              <Box>
                <Text dimColor>Active days: </Text>
                <Text color="white">{data.activeDays}</Text>
              </Box>
              <Box>
                <Text dimColor>Most active day: </Text>
                <Text color="white">{data.mostActiveDay}</Text>
              </Box>
            </Box>
            <Box flexDirection="column">
              <Box>
                <Text dimColor>Total tokens: </Text>
                <Text color="white">{(data.totalTokens / 1_000_000).toFixed(1)}m</Text>
              </Box>
              <Box marginTop={1}>
                <Text dimColor>Longest session: </Text>
                <Text color="greenBright">{formatDuration(data.longestSession)}</Text>
              </Box>
              <Box>
                <Text dimColor>Longest streak: </Text>
                <Text color="white">{data.longestStreak} days</Text>
              </Box>
              <Box>
                <Text dimColor>Current streak: </Text>
                <Text color="white">{data.currentStreak} days</Text>
              </Box>
            </Box>
          </Box>

          <Box marginTop={1}>
            <Text color="greenBright">Your longest session is ~{(data.longestSession / (45 * 60 * 1000)).toFixed(1)}x longer than listening to Abbey Road</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
            <Text bold color="white">Model Usage (Tokens)</Text>
            {Object.entries(data.modelUsage).sort((a,b) => b[1] - a[1]).map(([m, val]) => (
                <Box key={m} marginTop={1}>
                    <Box width={30}>
                        <Text color="greenBright">{m}</Text>
                    </Box>
                    <Text color="white">{(val / 1000).toFixed(1)}k tokens</Text>
                </Box>
            ))}
        </Box>
      )}

      <Box marginTop={1} paddingTop={1} borderStyle="round" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray">
        <Text dimColor>Esc to cancel  ·  r to cycle dates</Text>
      </Box>
    </Box>
  );
};
