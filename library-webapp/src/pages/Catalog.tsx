// screen Catalog "Browse and search the book catalog"
import { useEffect, useMemo, useState, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Chip,
  CircularProgress,
  ListingTable,
  MenuItem,
  PageContent,
  PageTitle,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { Inbox, Search } from "@wso2/oxygen-ui-icons-react";
import { libraryApi } from "../api";
import type { components } from "../generated/library-api";

type Book = components["schemas"]["Book"];

export function CatalogPage(): JSX.Element {
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("All");
  const [availability, setAvailability] = useState("All");

  useEffect(() => {
    let live = true;
    setError(null);
    libraryApi
      .GET("/books", { params: { query: { limit: 100 } } })
      .then(({ data, error: err }) => {
        if (!live) return;
        if (err) {
          setError("Could not load the catalog.");
          return;
        }
        setBooks(data?.data ?? []);
      })
      .catch(() => live && setError("Could not load the catalog."));
    return () => {
      live = false;
    };
  }, []);

  const genres = useMemo(() => {
    const set = new Set((books ?? []).map((b) => b.genre));
    return ["All", ...Array.from(set).sort()];
  }, [books]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (books ?? []).filter((b) => {
      const matchesSearch =
        q.length === 0 || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
      const matchesGenre = genre === "All" || b.genre === genre;
      const matchesAvailability =
        availability === "All" ||
        (availability === "Available" && b.status === "available") ||
        (availability === "On loan" && b.status === "on-loan");
      return matchesSearch && matchesGenre && matchesAvailability;
    });
  }, [books, search, genre, availability]);

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Catalog</PageTitle.Header>
        <PageTitle.SubHeader>Browse and search the book catalog</PageTitle.SubHeader>
      </PageTitle>

      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <TextField
          placeholder="Search title or author"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: { startAdornment: <Search size={18} style={{ marginRight: 8 }} /> },
          }}
          sx={{ minWidth: 260 }}
        />
        <TextField select label="Genre" value={genre} onChange={(e) => setGenre(e.target.value)} sx={{ minWidth: 200 }}>
          {genres.map((g) => (
            <MenuItem key={g} value={g}>
              {g}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Availability"
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="All">All</MenuItem>
          <MenuItem value="Available">Available</MenuItem>
          <MenuItem value="On loan">On loan</MenuItem>
        </TextField>
      </Box>

      {error ? (
        <Typography color="error">{error}</Typography>
      ) : books === null ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <ListingTable.Container>
          <ListingTable>
            <ListingTable.Head>
              <ListingTable.Row>
                <ListingTable.Cell>Title</ListingTable.Cell>
                <ListingTable.Cell>Author</ListingTable.Cell>
                <ListingTable.Cell>Genre</ListingTable.Cell>
                <ListingTable.Cell>Status</ListingTable.Cell>
              </ListingTable.Row>
            </ListingTable.Head>
            <ListingTable.Body>
              {filtered.length === 0 ? (
                <ListingTable.Row>
                  <ListingTable.Cell colSpan={4}>
                    <ListingTable.EmptyState
                      illustration={<Inbox size={64} />}
                      title="No books found"
                      description="Try adjusting your search or filters."
                    />
                  </ListingTable.Cell>
                </ListingTable.Row>
              ) : (
                filtered.map((b) => (
                  <ListingTable.Row key={b.id} clickable hover onClick={() => navigate(`/books/${b.id}`)}>
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
      )}
    </PageContent>
  );
}
