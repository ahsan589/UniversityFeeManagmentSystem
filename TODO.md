# Task: Replace "admission number" with "student id" across all files

## Information Gathered
- "Admission No:" labels found in:
  - src/components/Reports/StudentFeeReport.jsx (2 instances)
  - src/components/Challan/Payment.jsx (1 instance)
- "admissionNo" variable references found in:
  - src/components/Reports/StudentFeeReport.jsx (multiple instances)
  - src/components/Reports/MonthlyCollection.jsx (2 instances)
  - src/components/Reports/Defaulters.jsx (2 instances)
  - src/components/Reports/DailyCollection.jsx (2 instances)
  - src/components/Challan/Payment.jsx (1 instance)
- "admission no" text found in:
  - src/components/Reports/StudentFeeReport.jsx (placeholder text)
- The "student.id" is already used as the document ID (student ID), while "admissionNo" is a separate field
- Plan: Replace "Admission No:" with "Student ID:", change "admissionNo" references to "id", and update text accordingly

## Plan
1. Update labels from "Admission No:" to "Student ID:" in all files
2. Change variable references from "admissionNo" to "id" in all files
3. Update placeholder text from "admission no" to "student id"
4. Update any related CSS classes if needed (e.g., "admission-cell" to "student-id-cell")

## Dependent Files to be edited
- [x] src/components/Reports/StudentFeeReport.jsx
- [x] src/components/Challan/Payment.jsx
- [x] src/components/Reports/MonthlyCollection.jsx
- [x] src/components/Reports/Defaulters.jsx
- [x] src/components/Reports/DailyCollection.jsx (already correct)
- [x] src/components/Reports/MonthlyCollection.css (if class names change)
- [x] src/components/Reports/Defaulters.css (if class names change)
- [x] src/components/Reports/DailyCollection.css (if class names change)

## Followup steps
- [x] Test the application to ensure all changes work correctly
- [x] Verify that student ID displays properly in all reports and components
