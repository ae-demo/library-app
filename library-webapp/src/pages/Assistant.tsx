// screen Assistant "Ask for a suggestion or ask about your loans"
import { useState, type JSX } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  PageContent,
  PageTitle,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { sendChatMessage } from "../agentApi";

const PROMPTS = ["Something light and funny for a long flight?", "When is my book due?"];

interface Turn {
  role: "user" | "assistant";
  text: string;
}

export function AssistantPage(): JSX.Element {
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const text = message.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    setTranscript((t) => [...t, { role: "user", text }]);
    setMessage("");
    try {
      const response = await sendChatMessage({ conversationId, message: text });
      setConversationId(response.conversationId);
      setTranscript((t) => [...t, { role: "assistant", text: response.text }]);
    } catch {
      setError("The assistant could not answer that just now. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Library Assistant</PageTitle.Header>
      </PageTitle>

      <List sx={{ mb: 2 }}>
        {PROMPTS.map((prompt) => (
          <ListItemButton key={prompt} onClick={() => setMessage(prompt)}>
            <ListItemText primary={prompt} />
          </ListItemButton>
        ))}
      </List>

      {transcript.length > 0 ? (
        <Stack spacing={2} sx={{ mb: 3 }}>
          {transcript.map((turn, i) => (
            <Card key={i} variant="outlined" sx={{ bgcolor: turn.role === "user" ? "background.paper" : "action.hover" }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  {turn.role === "user" ? "You" : "Assistant"}
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
                  {turn.text}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : null}

      <TextField
        multiline
        minRows={3}
        fullWidth
        placeholder="Describe what you're in the mood for, or ask about your loans"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        sx={{ mb: 2 }}
      />
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Button variant="contained" onClick={handleSend} disabled={sending || !message.trim()}>
          Send
        </Button>
        {sending ? <CircularProgress size={20} /> : null}
      </Box>
      {error ? (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      ) : null}
    </PageContent>
  );
}
