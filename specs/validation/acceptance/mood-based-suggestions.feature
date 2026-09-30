Feature: Mood-based book suggestions

  @story-5
  Rule: A member describing their mood gets two or three suggestions from available books, each with a reason

    Scenario: Describing a mood returns available suggestions with reasons
      Given "The Martian" and "Good Omens" are available in the catalog
      When Mia the member asks for "a short book about space, like The Martian"
      Then she receives between two and three suggested books
      And each suggested book comes with a one-line reason

    Scenario: Suggestions never include a book that is on loan
      Given "Good Omens" is on loan
      When Mia the member asks for "something light and funny"
      Then "Good Omens" is not among her suggestions
