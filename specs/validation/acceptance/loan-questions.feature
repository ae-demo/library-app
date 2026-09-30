Feature: Plain-language loan questions

  @story-6
  Rule: A member can ask about their own loans in plain language and get an answer from their real loans

    Scenario: Asking when a borrowed book is due
      Given Mia the member has borrowed "The Martian" due on "2026-09-30"
      When Mia the member asks "when is my book due?"
      Then she is told "The Martian" is due on "2026-09-30"

  @story-6 @negative
  Rule: The assistant answers only from the member's real loan history, never an invented one

    Scenario: Asking about a book the member never borrowed
      Given Mia the member has never borrowed "Good Omens"
      When Mia the member asks "when is Good Omens due?"
      Then she is not given a due date for "Good Omens"
