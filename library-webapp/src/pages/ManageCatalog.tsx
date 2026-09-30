// screen ManageCatalog "Librarian's catalog management"
import { useCallback, useEffect, useState, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  ListingTable,
  PageContent,
  PageTitle,
  Typography,
} from "@wso2/oxygen-ui";
import { Camera, Inbox, Plus } from "@wso2/oxygen-ui-icons-react";
import { libraryApi } from "../api";
import { Can } from "../authz/gates";
import type { components } from "../generated/library-api";

type Book = components["schemas"]["Book"];

export function ManageCatalogPage(): JSX.Element {
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    libraryApi
      .GET("/books", { params: { query: { limit: 100 } } })
      .then(({ data, error: err }) => {
        if (err) {
          setError("Could not load the catalog.");
          return;
        }
        setBooks(data?.data ?? []);
      })
      .catch(() => setError("Could not load the catalog."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRemove() {
    if (!selected) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      const { error: err } = await libraryApi.DELETE("/books/{bookId}", {
        params: { path: { bookId: selected } },
      });
      if (err) {
        setRemoveError("That book is currently on loan and cannot be removed.");
        return;
      }
      setSelected(null);
      load();
    } catch {
      setRemoveError("That book is currently on loan and cannot be removed.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Manage Catalog</PageTitle.Header>
        <PageTitle.Actions>
          <Can op="POST /books">
            <Button variant="outlined" startIcon={<Camera size={18} />} onClick={() => navigate("/manage-catalog/add-by-photo")}>
              Add by Photo
            </Button>
            <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => navigate("/manage-catalog/books")}>
              Add Book
            </Button>
          </Can>
        </PageTitle.Actions>
      </PageTitle>

      {error ? (
        <Typography color="error">{error}</Typography>
      ) : books === null ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <ListingTable.Container>
            <ListingTable>
              <ListingTable.Head>
                <ListingTable.Row>
                  <Can op="DELETE /books/{bookId}">
                    <ListingTable.Cell />
                  </Can>
                  <ListingTable.Cell>Title</ListingTable.Cell>
                  <ListingTable.Cell>Author</ListingTable.Cell>
                  <ListingTable.Cell>Genre</ListingTable.Cell>
                  <ListingTable.Cell>Status</ListingTable.Cell>
                </ListingTable.Row>
              </ListingTable.Head>
              <ListingTable.Body>
                {books.length === 0 ? (
                  <ListingTable.Row>
                    <ListingTable.Cell colSpan={5}>
                      <ListingTable.EmptyState
                        illustration={<Inbox size={64} />}
                        title="No books in the catalog"
                        description="Add a book to get started."
                      />
                    </ListingTable.Cell>
                  </ListingTable.Row>
                ) : (
                  books.map((b) => (
                    <ListingTable.Row
                      key={b.id}
                      clickable
                      hover
                      onClick={() => navigate(`/manage-catalog/books/${b.id}`)}
                    >
                      <Can op="DELETE /books/{bookId}">
                        <ListingTable.Cell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected === b.id}
                            onChange={() => setSelected(selected === b.id ? null : b.id)}
                          />
                        </ListingTable.Cell>
                      </Can>
                      <ListingTable.Cell>{b.title}</ListingTable.Cell>
                      <ListingTable.Cell>{b.author}</ListingTable.Cell>
                      <ListingTable.Cell>{b.genre}</ListingTable.Cell>
                      <ListingTable.Cell>
                        <Chip
                          label={b.status === "available" ? "Available" : "On loan"}
                          size="small"
                          color={b.status === "available" ? "success" : "default"}
                        />
                      </ListingTable.Cell>
                    </ListingTable.Row>
                  ))
                )}
              </ListingTable.Body>
            </ListingTable>
          </ListingTable.Container>

          <Can op="DELETE /books/{bookId}">
            <Box sx={{ mt: 2 }}>
              <Button variant="outlined" color="error" disabled={!selected || removing} onClick={handleRemove}>
                Remove selected
              </Button>
              {removeError ? (
                <Typography color="error" sx={{ mt: 1 }}>
                  {removeError}
                </Typography>
              ) : null}
            </Box>
          </Can>
        </>
      )}
    </PageContent>
  );
}
