// screen AddBookByPhoto "Add a book by uploading a photo of it"
//
// library-agent's agent.afm.md declares x-aep.attachments (image/jpeg,
// image/png; 1 file; 5 MB), so this screen gets an attach control built to
// those constants. The agent's reply is free text — "read the extracted
// details back... and get a clear yes before adding" — so this page makes a
// best-effort read of "Title: …" style lines out of that text to prefill the
// editable fields the wireframe draws, and always leaves them editable: the
// librarian confirms (or corrects) before anything is added. "Confirm and
// Add" sends one more chat turn, on the same conversation, asking the agent
// to add the book with those (possibly edited) details; the agent is the one
// that calls library-api's addBook, per the design's sequence diagram.
import { useRef, useState, type ChangeEvent, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  PageContent,
  PageTitle,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { ImagePlus } from "@wso2/oxygen-ui-icons-react";
import { sendChatMessage, type ChatAttachment } from "../agentApi";

const ACCEPTED_TYPES = ["image/jpeg", "image/png"];
const MAX_FILES = 1;
const MAX_FILE_SIZE_MB = 5;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data: URL prefix — the contract wants raw base64.
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function extractField(text: string, label: string): string {
  const re = new RegExp(`${label}\\s*:\\s*(.+)`, "i");
  const match = re.exec(text);
  return match ? match[1].trim() : "";
}

export function AddBookByPhotoPage(): JSX.Element {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [agentReply, setAgentReply] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");

  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    setFileError(null);
    if (!files || files.length === 0) {
      setFile(null);
      return;
    }
    if (files.length > MAX_FILES) {
      setFileError(`Choose at most ${MAX_FILES} photo.`);
      return;
    }
    const chosen = files[0];
    if (!ACCEPTED_TYPES.includes(chosen.type)) {
      setFileError("Only JPEG or PNG photos are accepted.");
      return;
    }
    if (chosen.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setFileError(`That photo is larger than ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    setFile(chosen);
  }

  async function handleExtract() {
    if (!file) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const data = await readFileAsBase64(file);
      const attachment: ChatAttachment = { name: file.name, mediaType: file.type, data };
      const response = await sendChatMessage({
        conversationId,
        message: "Extract this book's title, author, genre and description from the photo.",
        attachments: [attachment],
      });
      setConversationId(response.conversationId);
      setAgentReply(response.text);
      setTitle(extractField(response.text, "Title"));
      setAuthor(extractField(response.text, "Author"));
      setGenre(extractField(response.text, "Genre"));
      setDescription(extractField(response.text, "Description"));
    } catch {
      // The agent keeps no files on a failure — leave the composer intact so
      // the librarian can retry.
      setExtractError("The photo could not be read. Try again.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleConfirm() {
    if (!conversationId) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const response = await sendChatMessage({
        conversationId,
        message:
          `Yes, add it with these details — ` +
          `Title: ${title}; Author: ${author}; Genre: ${genre}; Description: ${description}.`,
      });
      setAgentReply(response.text);
      navigate("/manage-catalog");
    } catch {
      setConfirmError("The book could not be added just now. Try again.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Add Book by Photo</PageTitle.Header>
      </PageTitle>

      <Box
        sx={{
          border: "1px dashed",
          borderColor: "divider",
          borderRadius: 1,
          p: 4,
          textAlign: "center",
          mb: 2,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          hidden
          onChange={handleFileChange}
        />
        <ImagePlus size={32} style={{ marginBottom: 8, opacity: 0.6 }} />
        <Typography variant="body1" sx={{ mb: 2 }}>
          {file ? file.name : "Upload a photo of the book"}
        </Typography>
        <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>
          Choose photo
        </Button>
      </Box>
      {fileError ? (
        <Typography color="error" sx={{ mb: 2 }}>
          {fileError}
        </Typography>
      ) : null}

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button variant="contained" onClick={handleExtract} disabled={!file || extracting}>
          Extract Details
        </Button>
        {extracting ? <CircularProgress size={20} /> : null}
      </Box>
      {extractError ? (
        <Typography color="error" sx={{ mb: 2 }}>
          {extractError}
        </Typography>
      ) : null}

      <Divider sx={{ mb: 3 }} />
      <Typography variant="h6" sx={{ mb: 2 }}>
        Extracted details
      </Typography>
      {agentReply ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, whiteSpace: "pre-wrap" }}>
          {agentReply}
        </Typography>
      ) : null}

      <Stack spacing={2} sx={{ maxWidth: 480 }}>
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
        <TextField label="Author" value={author} onChange={(e) => setAuthor(e.target.value)} fullWidth />
        <TextField label="Genre" value={genre} onChange={(e) => setGenre(e.target.value)} fullWidth />
        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          minRows={3}
          fullWidth
        />
      </Stack>

      {confirmError ? (
        <Typography color="error" sx={{ mt: 2 }}>
          {confirmError}
        </Typography>
      ) : null}

      <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={() => navigate("/manage-catalog")}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!conversationId || confirming || !title || !author || !genre}
        >
          Confirm and Add
        </Button>
      </Stack>
    </PageContent>
  );
}
