// screen MyLoans "The member's own loans"
import { useCallback, useEffect, useState, type JSX } from "react";
import { Box, Button, Chip, CircularProgress, ListingTable, PageContent, PageTitle, Typography } from "@wso2/oxygen-ui";
import { Inbox } from "@wso2/oxygen-ui-icons-react";
import { libraryApi } from "../api";
import { Can } from "../authz/gates";
import type { components } from "../generated/library-api";

type Loan = components["schemas"]["Loan"];

export function MyLoansPage(): JSX.Element {
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    libraryApi
      .GET("/me/loans", { params: { query: { limit: 100 } } })
      .then(({ data, error: err }) => {
        if (err) {
          setError("Could not load your loans.");
          return;
        }
        setLoans(data?.data ?? []);
      })
      .catch(() => setError("Could not load your loans."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReturn() {
    if (!selected) return;
    setReturning(true);
    setReturnError(null);
    try {
      const { error: err } = await libraryApi.POST("/me/loans/{loanId}/return", {
        params: { path: { loanId: selected } },
      });
      if (err) {
        setReturnError("That loan was already returned.");
        return;
      }
      setSelected(null);
      load();
    } catch {
      setReturnError("That loan was already returned.");
    } finally {
      setReturning(false);
    }
  }

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>My Loans</PageTitle.Header>
      </PageTitle>

      {error ? (
        <Typography color="error">{error}</Typography>
      ) : loans === null ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <ListingTable.Container>
            <ListingTable>
              <ListingTable.Head>
                <ListingTable.Row>
                  <ListingTable.Cell>Book</ListingTable.Cell>
                  <ListingTable.Cell>Borrowed</ListingTable.Cell>
                  <ListingTable.Cell>Due</ListingTable.Cell>
                  <ListingTable.Cell>Status</ListingTable.Cell>
                </ListingTable.Row>
              </ListingTable.Head>
              <ListingTable.Body>
                {loans.length === 0 ? (
                  <ListingTable.Row>
                    <ListingTable.Cell colSpan={4}>
                      <ListingTable.EmptyState
                        illustration={<Inbox size={64} />}
                        title="No loans yet"
                        description="Borrow a book from the catalog to see it here."
                      />
                    </ListingTable.Cell>
                  </ListingTable.Row>
                ) : (
                  loans.map((loan) => {
                    const onLoan = loan.returnedAt == null;
                    return (
                      <ListingTable.Row
                        key={loan.id}
                        clickable={onLoan}
                        hover={onLoan}
                        selected={selected === loan.id}
                        onClick={() => onLoan && setSelected(loan.id)}
                      >
                        <ListingTable.Cell>{loan.book?.title ?? loan.bookId}</ListingTable.Cell>
                        <ListingTable.Cell>{loan.borrowedAt}</ListingTable.Cell>
                        <ListingTable.Cell>{loan.dueAt}</ListingTable.Cell>
                        <ListingTable.Cell>
                          <Chip
                            label={onLoan ? "On loan" : "Returned"}
                            size="small"
                            color={onLoan ? "info" : "default"}
                          />
                        </ListingTable.Cell>
                      </ListingTable.Row>
                    );
                  })
                )}
              </ListingTable.Body>
            </ListingTable>
          </ListingTable.Container>

          <Can op="POST /me/loans/{loanId}/return">
            <Box sx={{ mt: 2 }}>
              <Button variant="outlined" disabled={!selected || returning} onClick={handleReturn}>
                Return
              </Button>
              {returnError ? (
                <Typography color="error" sx={{ mt: 1 }}>
                  {returnError}
                </Typography>
              ) : null}
            </Box>
          </Can>
        </>
      )}
    </PageContent>
  );
}
