// screen AddEditBook "Add or edit a book"
import { useEffect, useState, type JSX } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, CircularProgress, PageContent, PageTitle, Stack, TextField, Typography } from "@wso2/oxygen-ui";
import { libraryApi } from "../api";

export function AddEditBookPage(): JSX.Element {
  const { bookId } = useParams<{ bookId?: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(bookId);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId) return;
    let live = true;
    libraryApi
      .GET("/books/{bookId}", { params: { path: { bookId } } })
      .then(({ data, error: err }) => {
        if (!live) return;
        if (err || !data) {
          setError("That book could not be found.");
          return;
        }
        setTitle(data.title);
        setAuthor(data.author);
        setGenre(data.genre);
        setDescription(data.description ?? "");
      })
      .catch(() => live && setError("That book could not be found."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [bookId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const body = { title, author, genre, description };
    try {
      const { error: err } = isEdit
        ? await libraryApi.PUT("/books/{bookId}", { params: { path: { bookId: bookId! } }, body })
        : await libraryApi.POST("/books", { body });
      if (err) {
        setError("Those book details are not valid.");
        return;
      }
      navigate("/manage-catalog");
    } catch {
      setError("Those book details are not valid.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PageContent>
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      </PageContent>
    );
  }

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Book Details</PageTitle.Header>
      </PageTitle>

      <Stack spacing={2} sx={{ maxWidth: 480 }}>
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth required />
        <TextField label="Author" value={author} onChange={(e) => setAuthor(e.target.value)} fullWidth required />
        <TextField label="Genre" value={genre} onChange={(e) => setGenre(e.target.value)} fullWidth required />
        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          minRows={3}
          fullWidth
        />
      </Stack>

      {error ? (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      ) : null}

      <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={() => navigate("/manage-catalog")}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !title || !author || !genre}
        >
          Save
        </Button>
      </Stack>
    </PageContent>
  );
}
