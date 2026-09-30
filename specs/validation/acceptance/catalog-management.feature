Feature: Catalog management

  @story-7
  Rule: Librarians can add, edit and remove books in the catalog

    Scenario: Adding a new book
      When Leo the librarian adds a book titled "Project Hail Mary" by "Andy Weir"
      Then "Project Hail Mary" is in the catalog

    Scenario: Editing a book's details
      Given "Project Hail Mary" is in the catalog
      When Leo the librarian edits its genre to "Science Fiction"
      Then "Project Hail Mary" is listed with genre "Science Fiction"

  @story-7 @negative
  Rule: A book currently on loan cannot be removed until it is returned

    Scenario: Removing a book that is on loan is refused
      Given "The Martian" is on loan to a member
      When Leo the librarian tries to remove "The Martian"
      Then "The Martian" is still in the catalog

  @story-8
  Rule: Librarians can see which books are overdue

    Scenario: Viewing the overdue list
      Given a loan for "Good Omens" is past its due date and not returned
      When Leo the librarian views overdue books
      Then "Good Omens" is in the overdue list
