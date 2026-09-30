Feature: Signing in

  @story-1
  Rule: A signed-in member or librarian can access the library app

    Scenario: A member signs in and reaches the catalog
      Given Mia is a registered member of the library
      When Mia signs in to the library app
      Then she sees the book catalog

    Scenario: A librarian signs in and reaches catalog management
      Given Leo is a registered librarian
      When Leo signs in to the library app
      Then he sees the catalog management view
