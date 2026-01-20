import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { studentsService, challansService, paymentsService, utils } from '../../services/firebaseService';
import './StudentFeeReport.css';

const StudentFeeReport = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const reportRef = useRef();
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [challans, setChallans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStudentList, setShowStudentList] = useState(!studentId);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    loadStudents();

    if (studentId) {
      loadStudentReport(studentId);
    } else {
      setLoading(false);
    }

    // Reset print mode when component mounts or studentId changes
    setPrintMode(false);

    // Cleanup function to reset print mode when component unmounts
    return () => {
      setPrintMode(false);
    };
  }, [studentId]);

  const loadStudents = async () => {
    try {
      const studentsData = await studentsService.getAllStudents();
      console.log('Loaded students:', studentsData);
      setStudents(studentsData);
    } catch (error) {
      console.error('Error loading students:', error);
      setStudents([]);
    }
  };

  const loadStudentReport = async (studentDocId) => {
    setLoading(true);
    try {
      console.log('Loading report for student ID:', studentDocId);

      // Get student data by document ID
      const student = await studentsService.getStudentById(studentDocId);
      console.log('Student data:', student);

      if (!student) {
        throw new Error('Student not found');
      }

      // Get all challans and filter by studentId
      const allChallans = await challansService.getAllChallans();
      console.log('All challans:', allChallans);
      
      const studentChallans = allChallans.filter(challan => challan.studentId === studentDocId);
      console.log('Filtered challans:', studentChallans);

      // Get payments for this student
      let studentPayments = [];
      try {
        const allPayments = await paymentsService.getAllPayments();
        studentPayments = allPayments.filter(payment => payment.studentId === studentDocId);
        console.log('Student payments:', studentPayments);
      } catch (paymentError) {
        console.log('Could not load payments:', paymentError);
      }

      // Use student's totalFee from student record as base
      const studentTotalFee = parseFloat(student.totalFee || 0);
      
      // Calculate totals based on ACTUAL challan data
      const totalFeesFromChallans = studentChallans.reduce((total, challan) => total + parseFloat(challan.totalAmount || 0), 0);
      const totalPaidFromChallans = studentChallans.reduce((total, challan) => total + parseFloat(challan.paidAmount || 0), 0);
      
      // Use the higher value between student record and challans
      const totalDue = Math.max(studentTotalFee, totalFeesFromChallans);
      const totalPaid = totalPaidFromChallans;
      const totalDueFee = totalDue - totalPaid;

      // Process challans with payment details - USE ACTUAL DATA FROM FIREBASE
      const processedChallans = studentChallans.map(challan => {
        // Find payments for this specific challan
        const challanPayments = studentPayments.filter(payment => {
          return payment.challanId === challan.id || 
                 payment.challanNumber === challan.challanNumber ||
                 (payment.challanId === challan.challanId) ||
                 (payment.studentId === studentDocId && 
                  (!payment.challanId || payment.challanId === challan.id));
        });

        console.log(`Challan ${challan.challanNumber} payments:`, challanPayments);

        // Use ACTUAL amounts from challan
        const paidAmount = parseFloat(challan.paidAmount || 0);
        const totalAmount = parseFloat(challan.totalAmount || 0);
        const dueFee = totalAmount - paidAmount;
        
        // USE THE ACTUAL STATUS FROM FIREBASE
        let status = challan.status;
        if (!status) {
          // Fallback calculation only if status is not present
          if (paidAmount >= totalAmount) {
            status = 'Paid';
          } else if (paidAmount > 0 && paidAmount < totalAmount) {
            status = 'Partial';
          } else {
            status = 'Unpaid';
          }
        }

        console.log(`Challan ${challan.challanNumber}: DB Status=${challan.status}, Final Status=${status}, Total=${totalAmount}, Paid=${paidAmount}, Due=${dueFee}`);

        return {
          ...challan,
          paidAmount, // Use actual paidAmount from challan
          dueFee,     // Calculate due fee
          status,     // Use the actual status from Firebase
          payments: challanPayments
        };
      });

      // If no challans, create a dummy challan from student data
      let finalChallans = processedChallans;
      if (studentChallans.length === 0 && studentTotalFee > 0) {
        finalChallans = [{
          id: 'no-challan',
          challanNumber: 'Not Generated',
          issueDate: student.admissionDate || new Date(),
          dueDate: student.admissionDate || new Date(),
          description: 'Admission Fee',
          totalAmount: studentTotalFee,
          paidAmount: 0,
          dueFee: studentTotalFee,
          status: 'Unpaid',
          payments: []
        }];
      }

      const studentData = {
        ...student,
        id: studentDocId,
        admissionNo: studentDocId,
        totalDue,
        totalPaid,
        totalDueFee,
        hasChallans: studentChallans.length > 0,
        studentTotalFee: studentTotalFee
      };

      setSelectedStudent(studentData);
      setChallans(finalChallans);
      setPayments(studentPayments);
      setShowStudentList(false);
      
    } catch (error) {
      console.error('Error loading student report:', error);
      setSelectedStudent(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (student) => {
    // Reset print mode when selecting a new student
    setPrintMode(false);
    navigate(`/student-fee-report/${student.id}`);
  };

  const handleBackToList = () => {
    setSelectedStudent(null);
    setShowStudentList(true);
    setPrintMode(false); // Reset print mode
    navigate('/student-fee-report');
  };

  const handlePrint = () => {
    setPrintMode(true);
    setTimeout(() => {
      const printContent = reportRef.current;
      const printWindow = window.open('', '_blank');
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Fee Clearance Report - ${selectedStudent?.name || 'Student'}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 20px;
                color: #333;
                font-size: 12pt;
              }
              .report-header-print {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 30px;
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
                flex-wrap: wrap;
              }
              .college-info {
                flex: 1;
                min-width: 250px;
              }
              .college-info h1 {
                margin: 0 0 10px 0;
                color: #2c5aa0;
                font-size: 18pt;
              }
              .college-name {
                font-size: 14pt;
                font-weight: bold;
                margin: 5px 0;
              }
              .college-address {
                margin: 5px 0;
                color: #666;
                font-size: 11pt;
              }
              .report-date {
                margin: 5px 0;
                color: #666;
                font-size: 10pt;
              }
              .report-meta {
                text-align: right;
                flex-shrink: 0;
              }
              .student-info-section, .fee-summary-section, .challan-details-section, .payment-history-section, .clearance-status-section {
                margin-bottom: 30px;
              }
              h2 {
                color: #2c5aa0;
                border-bottom: 1px solid #ddd;
                padding-bottom: 5px;
                margin-bottom: 15px;
                font-size: 14pt;
              }
              .info-grid-print {
                display: grid;
                gap: 15px;
              }
              .info-row {
                display: flex;
                gap: 20px;
                flex-wrap: wrap;
              }
              .info-col {
                flex: 1;
                min-width: 200px;
              }
              .info-col.full-width {
                flex: 100%;
              }
              .info-col label {
                font-weight: bold;
                display: block;
                margin-bottom: 5px;
                font-size: 11pt;
              }
              .info-col span {
                font-size: 11pt;
              }
              .note-text {
                color: #d32f2f !important;
                font-style: italic;
              }
              .summary-cards-print {
                display: flex;
                gap: 20px;
                margin-bottom: 20px;
                flex-wrap: wrap;
              }
              .summary-card-print {
                flex: 1;
                padding: 15px;
                border-radius: 8px;
                text-align: center;
                min-width: 150px;
              }
              .summary-card-print.total {
                background-color: #e3f2fd;
                border: 1px solid #2196f3;
              }
              .summary-card-print.paid {
                background-color: #e8f5e8;
                border: 1px solid #4caf50;
              }
              .summary-card-print.due {
                background-color: #ffebee;
                border: 1px solid #f44336;
              }
              .summary-card-print h3 {
                font-size: 10pt;
                margin: 0 0 10px 0;
              }
              .summary-card-print p {
                font-size: 14pt;
                margin: 0;
                font-weight: bold;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
                font-size: 10pt;
                table-layout: fixed;
              }
              th, td {
                border: 1px solid #ddd;
                padding: 8px 10px;
                text-align: left;
                word-wrap: break-word;
              }
              th {
                background-color: #f5f5f5;
                font-weight: bold;
              }
              .amount {
                text-align: right;
                font-family: 'Courier New', monospace;
                font-weight: bold;
              }
              .negative {
                color: #d32f2f;
              }
              .positive {
                color: #388e3c;
              }
              .status-badge {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 9pt;
                font-weight: bold;
                white-space: nowrap;
              }
              .status-badge.paid {
                background-color: #4caf50;
                color: white;
              }
              .status-badge.partial {
                background-color: #ff9800;
                color: white;
              }
              .status-badge.unpaid {
                background-color: #f44336;
                color: white;
              }
              .status-badge.pending {
                background-color: #ff9800;
                color: white;
              }
              .clearance-badge {
                padding: 20px;
                border-radius: 8px;
                text-align: center;
                margin: 20px 0;
              }
              .cleared {
                background-color: #e8f5e8;
                border: 2px solid #4caf50;
              }
              .pending {
                background-color: #fff3e0;
                border: 2px solid #ff9800;
              }
              .status-cleared h3,
              .status-pending h3 {
                font-size: 14pt;
                margin: 0 0 10px 0;
              }
              .report-footer {
                margin-top: 50px;
                border-top: 1px solid #ddd;
                padding-top: 20px;
              }
              .signature-section {
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
                flex-wrap: wrap;
                gap: 20px;
              }
              .signature-box {
                text-align: center;
                flex: 1;
                min-width: 150px;
              }
              .signature-line {
                width: 150px;
                border-top: 1px solid #333;
                margin-top: 40px;
              }
              .footer-note {
                text-align: center;
                color: #666;
                font-size: 9pt;
              }
              @media print {
                body { margin: 0; }
                .no-print { display: none !important; }
                @page {
                  margin: 0.5in;
                  size: letter;
                }
              }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
          setPrintMode(false); // Reset print mode after printing
        };
        
        // Fallback: reset print mode after 5 seconds if onafterprint doesn't fire
        setTimeout(() => {
          setPrintMode(false);
        }, 5000);
        
      }, 500);
      
    }, 100);
  };

  const handleDownloadPDF = () => {
    handlePrint(); // For now, use print functionality
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      if (date.toDate) {
        return date.toDate().toLocaleDateString('en-GB');
      }
      if (typeof date === 'string') {
        return new Date(date).toLocaleDateString('en-GB');
      }
      return new Date(date).toLocaleDateString('en-GB');
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid Date';
    }
  };

  const formatCurrency = (amount) => {
    return `Rs. ${parseFloat(amount || 0).toLocaleString('en-PK')}`;
  };

  // FIXED: Search functionality - properly filter students
  const filteredStudents = students.filter(student => {
    if (!searchTerm.trim()) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      student.name?.toLowerCase().includes(searchLower) ||
      student.id?.toLowerCase().includes(searchLower) ||
      student.program?.toLowerCase().includes(searchLower) ||
      student.fatherName?.toLowerCase().includes(searchLower) ||
      student.contact?.toLowerCase().includes(searchLower) ||
      student.phone?.toLowerCase().includes(searchLower)
    );
  });

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm('');
  };

  if (loading) {
    return (
      <div className="student-fee-report">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading student fee report...</p>
        </div>
      </div>
    );
  }

  if (showStudentList) {
    return (
      <div className="student-fee-report">
        <div className="report-header">
          <h2>Student Fee Reports</h2>
          <p>Select a student to view their fee clearance report</p>
        </div>

        <div className="search-section">
          <div className="search-input-group">
            <input
              type="text"
              placeholder="Search by name, student id, program, father name, or contact..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="search-input"
              aria-label="Search students"
            />
            {searchTerm && (
              <button 
                onClick={handleClearSearch}
                style={{
                  position: 'absolute',
                  right: '40px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6c757d',
                  fontSize: '1rem'
                }}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="students-list">
          <h3>
            Students 
            {searchTerm ? ` (${filteredStudents.length} of ${students.length} found)` : ` (${students.length})`}
          </h3>
          {filteredStudents.length === 0 ? (
            <div className="no-results">
              <p>
                {searchTerm 
                  ? `No students found matching "${searchTerm}". Try a different search term.`
                  : 'No students found in the system.'
                }
              </p>
              {searchTerm && (
                <button 
                  onClick={handleClearSearch}
                  className="back-btn"
                  style={{ marginTop: '15px' }}
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="students-grid">
              {filteredStudents.map(student => (
                <div
                  key={student.id}
                  className="student-card"
                  onClick={() => handleStudentSelect(student)}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => e.key === 'Enter' && handleStudentSelect(student)}
                >
                  <div className="student-avatar">
                    {student.name?.charAt(0).toUpperCase() || 'S'}
                  </div>
                  <div className="student-details">
                    <h4>{student.name || 'Unknown Student'}</h4>
                    <p><strong>Student ID:</strong> {student.id || 'N/A'}</p>
                    <p><strong>Program:</strong> {student.program || 'N/A'}</p>
                    {student.fatherName && <p><strong>Father:</strong> {student.fatherName}</p>}
                  </div>
                  <div className="view-report-btn">
                    View Report →
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!selectedStudent) {
    return (
      <div className="student-fee-report">
        <div className="error">
          <h3>Student Not Found</h3>
          <p>The requested student could not be found in the system.</p>
        </div>
        <button className="back-btn" onClick={handleBackToList}>
          ← Back to Student List
        </button>
      </div>
    );
  }

  return (
    <div className={`student-fee-report ${printMode ? 'print-mode' : ''}`}>
      {/* Action Buttons - Hidden in print mode */}
      {!printMode && (
        <div className="report-actions no-print">
          <button className="back-btn" onClick={handleBackToList}>
            ← Back to Student List
          </button>
          <div className="action-buttons">
            <button className="print-btn" onClick={handlePrint}>
              🖨️ Print Report
            </button>
            <button className="download-btn" onClick={handleDownloadPDF}>
              📥 Download PDF
            </button>
            <button className="refresh-btn" onClick={() => loadStudentReport(studentId)}>
              🔄 Refresh
            </button>
          </div>
        </div>
      )}

      {/* Printable Report Content */}
      <div ref={reportRef} className="fee-clearance-report">
        {/* Report Header */}
        <div className="report-header-print">
          <div className="college-info">
            <h1>Fee Clearance Report</h1>
            <p className="college-name">AGS COLLEGE OF EDUCATION</p>
            <p className="college-address">Chakri Road Rawalpindi</p>
            <p className="report-date">Generated on: {new Date().toLocaleDateString('en-GB')}</p>
          </div>
          <div className="report-meta">
            <div className="meta-item">
              <span>Report ID:</span>
              <strong>FCR-{Date.now().toString().slice(-6)}</strong>
            </div>
            <div className="meta-item">
              <span>Date:</span>
              <strong>{new Date().toLocaleDateString('en-GB')}</strong>
            </div>
          </div>
        </div>

        {/* Student Information */}
        <div className="student-info-section">
          <h2>Student Information</h2>
          <div className="info-grid-print">
            <div className="info-row">
              <div className="info-col">
                <label>Student Name:</label>
                <span>{selectedStudent.name || 'N/A'}</span>
              </div>
              <div className="info-col">
                <label>Student ID:</label>
                <span>{selectedStudent.id || 'N/A'}</span>
              </div>
            </div>
            <div className="info-row">
              <div className="info-col">
                <label>Father's Name:</label>
                <span>{selectedStudent.fatherName || 'N/A'}</span>
              </div>
              <div className="info-col">
                <label>Program:</label>
                <span>{selectedStudent.program || 'N/A'}</span>
              </div>
            </div>
            <div className="info-row">
              <div className="info-col">
                <label>Contact:</label>
                <span>{selectedStudent.contact || selectedStudent.phone || 'N/A'}</span>
              </div>
              <div className="info-col">
                <label>Admission Date:</label>
                <span>{formatDate(selectedStudent.admissionDate)}</span>
              </div>
            </div>
            {!selectedStudent.hasChallans && (
              <div className="info-row">
                <div className="info-col full-width">
                  <label>Note:</label>
                  <span className="note-text">No fee challan generated yet. Showing admission fee details.</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fee Summary */}
        <div className="fee-summary-section">
          <h2>Fee Summary</h2>
          <div className="summary-cards-print">
            <div className="summary-card-print total">
              <h3>Total Fee</h3>
              <p>{formatCurrency(selectedStudent.totalDue)}</p>
            </div>
            <div className="summary-card-print paid">
              <h3>Paid Fee</h3>
              <p>{formatCurrency(selectedStudent.totalPaid)}</p>
            </div>
            <div className="summary-card-print due">
              <h3>Due Fee</h3>
              <p className={selectedStudent.totalDueFee > 0 ? 'negative' : 'positive'}>
                {formatCurrency(Math.abs(selectedStudent.totalDueFee))}
                {selectedStudent.totalDueFee > 0 ? ' (Due)' : ' (Clear)'}
              </p>
            </div>
          </div>
        </div>

        {/* Challan Details */}
        <div className="challan-details-section">
          <h2>Fee Challan Details</h2>
          {challans.length === 0 ? (
            <div className="no-challans">
              <p>No fee challans generated for this student yet.</p>
            </div>
          ) : (
            <table className="challan-table">
              <thead>
                <tr>
                  <th>Challan No</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Description</th>
                  <th>Total Fee</th>
                  <th>Paid Fee</th>
                  <th>Due Fee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {challans.map((challan, index) => (
                  <tr key={challan.id || index} className={challan.id === 'no-challan' ? 'no-challan-row' : ''}>
                    <td className="challan-number">{challan.challanNumber || `CH-${index + 1}`}</td>
                    <td>{formatDate(challan.issueDate)}</td>
                    <td>{formatDate(challan.dueDate)}</td>
                    <td>{challan.description || 'Tuition Fee'}</td>
                    <td className="amount">{formatCurrency(challan.totalAmount)}</td>
                    <td className="amount paid">{formatCurrency(challan.paidAmount)}</td>
                    <td className={`amount ${challan.dueFee > 0 ? 'negative' : 'positive'}`}>
                      {formatCurrency(Math.abs(challan.dueFee))}
                    </td>
                    <td>
                      <span className={`status-badge ${challan.status?.toLowerCase()}`}>
                        {challan.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan="4"><strong>Total</strong></td>
                  <td className="amount total-amount"><strong>{formatCurrency(selectedStudent.totalDue)}</strong></td>
                  <td className="amount total-amount"><strong>{formatCurrency(selectedStudent.totalPaid)}</strong></td>
                  <td className={`amount total-amount ${selectedStudent.totalDueFee > 0 ? 'negative' : 'positive'}`}>
                    <strong>{formatCurrency(Math.abs(selectedStudent.totalDueFee))}</strong>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Payment History */}
        {payments.length > 0 && (
          <div className="payment-history-section">
            <h2>Payment History</h2>
            <table className="payment-table">
              <thead>
                <tr>
                  <th>Payment Date</th>
                  <th>Amount</th>
                  <th>Payment Method</th>
                  <th>Challan No</th>
                  <th>Remarks</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment, index) => (
                  <tr key={payment.id || index}>
                    <td>{formatDate(payment.paymentDate)}</td>
                    <td className="amount">{formatCurrency(payment.amount)}</td>
                    <td>{payment.paymentMethod || 'Cash'}</td>
                    <td>{payment.challanNumber || payment.challanId || '-'}</td>
                    <td className="remarks">{payment.remarks || '-'}</td>
                    <td>
                      <span className="status-badge paid">Paid</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td><strong>Total Paid</strong></td>
                  <td className="amount total-amount"><strong>{formatCurrency(selectedStudent.totalPaid)}</strong></td>
                  <td colSpan="4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Clearance Status */}
        <div className="clearance-status-section">
          <h2>Fee Clearance Status</h2>
          <div className={`clearance-badge ${selectedStudent.totalDueFee <= 0 ? 'cleared' : 'pending'}`}>
            {selectedStudent.totalDueFee <= 0 ? (
              <div className="status-cleared">
                <h3>✅ FEES CLEARED</h3>
                <p>All dues have been cleared. Student is eligible for exams and other academic activities.</p>
              </div>
            ) : (
              <div className="status-pending">
                <h3>⚠️ PENDING DUES</h3>
                <p>Outstanding due fee: {formatCurrency(selectedStudent.totalDueFee)}</p>
                <p>Student must clear dues to be eligible for exams.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="report-footer">
          <div className="signature-section">
            <div className="signature-box">
              <p>Accountant Signature</p>
              <div className="signature-line"></div>
            </div>
            <div className="signature-box">
              <p>Student Signature</p>
              <div className="signature-line"></div>
            </div>
          </div>
          <div className="footer-note">
            <p>This is a computer-generated fee clearance report. No signature is required.</p>
            <p>Generated by AGS College of Education Fee Management System</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentFeeReport;