// screen BookDetail "A single book's details"
import { useEffect, useState, type JSX } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, Chip, CircularProgress, PageContent, PageTitle, Typography } from "@wso2/oxygen-ui";
import { libraryApi } from "../api";
import { Can } from "../authz/gates";
import type { components } from "../generated/library-api";

type Book = components["schemas"]["Book"];

export function BookDetailPage(): JSX.Element {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [borrowing, setBorrowing] = useState(false);
  const [borrowError, setBorrowError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId) return;
    let live = true;
    libraryApi
      .GET("/books/{bookId}", { params: { path: { bookId } } })
      .then(({ data, error: err }) => {
        if (!live) return;
        if (err) {
          setError("That book could not be found.");
          return;
        }
        setBook(data ?? null);
      })
      .catch(() => live && setError("That book could not be found."));
    return () => {
      live = false;
    };
  }, [bookId]);

  async function handleBorrow() {
    if (!bookId) return;
    setBorrowing(true);
    setBorrowError(null);
    try {
      const { error: err } = await libraryApi.POST("/me/loans", { body: { bookId } });
      if (err) {
        setBorrowError("This book is not available to borrow.");
        return;
      }
      navigate("/my-loans");
    } catch {
      setBorrowError("This book is not available to borrow.");
    } finally {
      setBorrowing(false);
    }
  }

  if (error) {
    return (
      <PageContent>
        <Typography color="error">{error}</Typography>
      </PageContent>
    );
  }

  if (!book) {
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
        <PageTitle.BackButton onClick={() => navigate("/catalog")}>Back</PageTitle.BackButton>
        <PageTitle.Header>{book.title}</PageTitle.Header>
      </PageTitle>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
        {book.author} · {book.genre}
      </Typography>
      <Chip
        label={book.status === "available" ? "Available" : "On loan"}
        color={book.status === "available" ? "success" : "default"}
        size="small"
        sx={{ mb: 2 }}
      />
      <Typography variant="body1" sx={{ mb: 3 }}>
        {book.description}
      </Typography>
      <Can op="POST /me/loans">
        <Button
          variant="contained"
          disabled={book.status !== "available" || borrowing}
          onClick={handleBorrow}
        >
          Borrow for two weeks
        </Button>
      </Can>
      {borrowError ? (
        <Typography color="error" sx={{ mt: 2 }}>
          {borrowError}
        </Typography>
      ) : null}
    </PageContent>
  );
}
