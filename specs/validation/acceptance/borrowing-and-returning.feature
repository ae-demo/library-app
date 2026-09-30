Feature: Borrowing and returning books

  @story-3
  Rule: A member may borrow an available book for two weeks

    Scenario: Borrowing an available book creates a two-week loan
      Given "The Martian" is available in the catalog
      When Mia the member borrows "The Martian"
      Then Mia has a loan for "The Martian" due in two weeks
      And "The Martian" is no longer available in the catalog

    @negative
    Scenario: Borrowing a book already on loan is refused
      Given "Good Omens" is on loan to another member
      When Mia the member tries to borrow "Good Omens"
      Then Mia does not gain a loan for "Good Omens"

  @story-4
  Rule: A member may return a book they have borrowed

    Scenario: Returning a borrowed book makes it available again
      Given Mia the member has borrowed "The Martian"
      When Mia the member returns "The Martian"
      Then "The Martian" is available in the catalog
