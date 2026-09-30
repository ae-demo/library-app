screen Catalog "Browse and search the book catalog"
  navbar "Library"
  sidebar "Catalog -> Catalog | My Loans -> MyLoans | Assistant -> Assistant"
  row
    search "Search title or author"
    select "Genre"
    select "Availability"
  table "Title | Author | Genre | Status" -> BookDetail
    row "The Martian | Andy Weir | Science Fiction | Available"
    row "Good Omens | Terry Pratchett and Neil Gaiman | Comedy | On loan"

screen BookDetail "A single book's details"
  navbar "Library"
  sidebar "Catalog -> Catalog | My Loans -> MyLoans | Assistant -> Assistant"
  heading "The Martian"
  text "Andy Weir · Science Fiction"
  badge "Available" success
  text "An astronaut stranded on Mars fights to survive."
  button "Borrow for two weeks" primary -> MyLoans

screen MyLoans "The member's own loans"
  navbar "Library"
  sidebar "Catalog -> Catalog | My Loans -> MyLoans | Assistant -> Assistant"
  heading "My Loans"
  table "Book | Borrowed | Due | Status"
    row "The Martian | Sep 16 | Sep 30 | On loan"
    row "Good Omens | Aug 1 | Aug 15 | Returned"
  button "Return" // returns the selected loan in place, no navigation

screen Assistant "Ask for a suggestion or ask about your loans"
  navbar "Library"
  sidebar "Catalog -> Catalog | My Loans -> MyLoans | Assistant -> Assistant"
  heading "Library Assistant"
  list "Something light and funny for a long flight? | When is my book due?"
  textarea "Describe what you're in the mood for, or ask about your loans"
  button "Send" primary // reply appears in place on this screen

screen ManageCatalog "Librarian's catalog management"
  navbar "Library"
  sidebar "Catalog -> ManageCatalog | Overdue -> Overdue"
  row
    heading "Manage Catalog"
    right
    button "Add by Photo" -> AddBookByPhoto
    button "Add Book" primary -> AddEditBook
  table "Title | Author | Genre | Status" -> AddEditBook
    row "The Martian | Andy Weir | Science Fiction | Available"
    row "Good Omens | Terry Pratchett and Neil Gaiman | Comedy | On loan"
  button "Remove selected" danger // refused when the selected book is on loan

screen AddEditBook "Add or edit a book"
  navbar "Library"
  sidebar "Catalog -> ManageCatalog | Overdue -> Overdue"
  heading "Book Details"
  input "Title"
  input "Author"
  input "Genre"
  textarea "Description"
  row
    right
    button "Cancel" -> ManageCatalog
    button "Save" primary -> ManageCatalog

screen AddBookByPhoto "Add a book by uploading a photo of it"
  navbar "Library"
  sidebar "Catalog -> ManageCatalog | Overdue -> Overdue"
  heading "Add Book by Photo"
  image "Upload a photo of the book"
  button "Extract Details" primary // the assistant reads the photo and replies in place
  divider
  text "Extracted details"
  input "Title"
  input "Author"
  input "Genre"
  textarea "Description"
  row
    right
    button "Cancel" -> ManageCatalog
    button "Confirm and Add" primary -> ManageCatalog

screen Overdue "Every overdue loan"
  navbar "Library"
  sidebar "Catalog -> ManageCatalog | Overdue -> Overdue"
  heading "Overdue Loans"
  table "Book | Member | Due"
    row "Good Omens | user-123 | Sep 10"

flow "Browse and borrow"
  role "Member"
  description "A member browses the catalog, borrows a book, and tracks their loans"
  Catalog
  BookDetail
  MyLoans

flow "Ask the assistant"
  role "Member"
  description "A member asks for a suggestion or asks about their own loans"
  Assistant

flow "Manage the catalog"
  role "Librarian"
  description "A librarian manages books and follows up on overdue loans"
  ManageCatalog
  AddEditBook
  AddBookByPhoto
  Overdue
