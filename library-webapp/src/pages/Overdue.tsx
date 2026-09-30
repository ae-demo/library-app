// screen Overdue "Every overdue loan"
import { useEffect, useState, type JSX } from "react";
import { Box, CircularProgress, ListingTable, PageContent, PageTitle, Typography } from "@wso2/oxygen-ui";
import { Inbox } from "@wso2/oxygen-ui-icons-react";
import { libraryApi } from "../api";
import type { components } from "../generated/library-api";

type Loan = components["schemas"]["Loan"];

export function OverduePage(): JSX.Element {
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    libraryApi
      .GET("/loans/overdue", { params: { query: { limit: 100 } } })
      .then(({ data, error: err }) => {
        if (!live) return;
        if (err) {
          setError("Could not load overdue loans.");
          return;
        }
        setLoans(data?.data ?? []);
      })
      .catch(() => live && setError("Could not load overdue loans."));
    return () => {
      live = false;
    };
  }, []);

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Overdue Loans</PageTitle.Header>
      </PageTitle>

      {error ? (
        <Typography color="error">{error}</Typography>
      ) : loans === null ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <ListingTable.Container>
          <ListingTable>
            <ListingTable.Head>
              <ListingTable.Row>
                <ListingTable.Cell>Book</ListingTable.Cell>
                <ListingTable.Cell>Member</ListingTable.Cell>
                <ListingTable.Cell>Due</ListingTable.Cell>
              </ListingTable.Row>
            </ListingTable.Head>
            <ListingTable.Body>
              {loans.length === 0 ? (
                <ListingTable.Row>
                  <ListingTable.Cell colSpan={3}>
                    <ListingTable.EmptyState
                      illustration={<Inbox size={64} />}
                      title="No overdue loans"
                      description="Everything is on schedule."
                    />
                  </ListingTable.Cell>
                </ListingTable.Row>
              ) : (
                loans.map((loan) => (
                  <ListingTable.Row key={loan.id}>
                    <ListingTable.Cell>{loan.book?.title ?? loan.bookId}</ListingTable.Cell>
                    <ListingTable.Cell>{loan.memberId}</ListingTable.Cell>
                    <ListingTable.Cell>{loan.dueAt}</ListingTable.Cell>
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
