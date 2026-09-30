Feature: Catalog browsing

  @story-2
  Rule: Members can search the catalog by title, author, genre, and availability

    Scenario: Searching by title returns the matching book
      Given the catalog has a book titled "The Martian" by "Andy Weir"
      When Mia the member searches the catalog for "Martian"
      Then "The Martian" is in her search results

    Scenario: Filtering by availability shows only available books
      Given "The Martian" is available in the catalog
      And "Good Omens" is on loan in the catalog
      When Mia the member filters the catalog to available books
      Then "The Martian" is in her results
      And "Good Omens" is not in her results
