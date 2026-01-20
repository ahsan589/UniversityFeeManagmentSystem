import React, { useState, useEffect } from 'react';
import { studentsService, challansService, paymentsService, utils } from '../../services/firebaseService';
import './GenerateChallan.css';

const GenerateChallan = () => {
  const [formData, setFormData] = useState({
    studentId: '',
    studentName: '',
    program: '',
    semester: '',
    totalAmount: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    description: 'Tuition Fee',
    installmentNumber: '1',
    paymentMode: 'Cash'
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [challanGenerated, setChallanGenerated] = useState(false);
  const [challanNumber, setChallanNumber] = useState('');
  const [voucherNumber, setVoucherNumber] = useState('');
  const [studentDetails, setStudentDetails] = useState(null);
  const [feeBreakdown, setFeeBreakdown] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);

  useEffect(() => {
    setChallanNumber(utils.generateChallanNumber());
  }, []);

  // New voucher number generation formula as per your requirement
  const generateVoucherNumber = (studentId, installmentNumber) => {
    if (!studentId) return '';
    
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // 11 for November
    const date = String(now.getDate()).padStart(2, '0'); // 18 for 18th
    const lastFiveDigits = studentId.slice(-5); // Last 5 digits of student ID
    
    // Format: Last5Digits + Month + Date + InstallmentNumber
    // Example: 11358 (last 5 digits) + 11 (month) + 18 (date) + 4 (installment) = 1135811184
    return `${lastFiveDigits}${month}${date}${installmentNumber}`;
  };

  // Update voucher number whenever student ID or installment number changes
  useEffect(() => {
    if (formData.studentId && formData.installmentNumber) {
      const newVoucherNumber = generateVoucherNumber(formData.studentId, formData.installmentNumber);
      setVoucherNumber(newVoucherNumber);
    }
  }, [formData.studentId, formData.installmentNumber]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Update voucher number if student ID or installment number changes
    if ((name === 'studentId' && value) || (name === 'installmentNumber' && value)) {
      const newVoucherNumber = generateVoucherNumber(
        name === 'studentId' ? value : formData.studentId,
        name === 'installmentNumber' ? value : formData.installmentNumber
      );
      setVoucherNumber(newVoucherNumber);
    }
  };

  const handleStudentSearch = async () => {
    if (!formData.studentId.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const student = await studentsService.getStudentById(formData.studentId);
      setStudentDetails(student);
      
      const breakdown = [];
      if (student.registrationFee) breakdown.push({ description: 'Registration Fee', amount: student.registrationFee });
      if (student.examFee) breakdown.push({ description: 'Exam Fee', amount: student.examFee });
      if (student.tuitionFee) breakdown.push({ description: 'Tuition Fee', amount: student.tuitionFee });
      if (student.universityShare) breakdown.push({ description: 'University Share', amount: student.universityShare });
      if (student.supplementary) breakdown.push({ description: 'Supplementary', amount: student.supplementary });
      if (student.previousMonthFine) breakdown.push({ description: 'Prev Month Fee Fine', amount: student.previousMonthFine });
      if (student.others) breakdown.push({ description: 'Disciplinary Fine/Restoration', amount: student.others });
      
      setFeeBreakdown(breakdown);
      
      const payments = await paymentsService.getStudentPayments(formData.studentId);
      setPaymentHistory(payments);
      
      const nextInstallment = payments.length < 4 ? (payments.length + 1).toString() : '4';
      
      const totalFees = utils.calculateTotalFees(student);
      
      setFormData(prev => ({
        ...prev,
        studentName: student.name || '',
        program: student.program || student.class || '',
        semester: student.semester || '',
        totalAmount: totalFees || '',
        installmentNumber: nextInstallment
      }));

      // Generate voucher number after student data is loaded
      const newVoucherNumber = generateVoucherNumber(formData.studentId, nextInstallment);
      setVoucherNumber(newVoucherNumber);
    } catch (error) {
      setError('Student not found. Please check Student ID.');
      setStudentDetails(null);
      setFeeBreakdown([]);
      setPaymentHistory([]);
      setVoucherNumber('');
    }
    
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!studentDetails) {
        throw new Error('Please search and select a student first');
      }

      const challanData = {
        ...formData,
        studentId: formData.studentId,
        challanNumber: challanNumber,
        voucherNumber: voucherNumber,
        status: 'Unpaid',
        createdAt: new Date(),
        studentName: studentDetails.name
      };

      await challansService.addChallan(challanData);
      setChallanGenerated(true);
    } catch (error) {
      setError(error.message || 'Failed to generate challan. Please try again.');
      console.error(error);
    }

    setLoading(false);
  };

  const handlePrint = () => {
    // Create a clone of the challan container for printing
    const printContent = document.getElementById('challan-preview').cloneNode(true);
    
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Challan</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              color: #000000;
              background: white;
            }
            body * {
              visibility: hidden;
            }
            .challan-container, .challan-container * {
              visibility: visible;
            }
            .challan-container {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 20px;
              display: flex;
              flex-wrap: wrap;
              gap: 20px;
              justify-content: space-between;
            }
            .challan {
              flex: 1;
              min-width: 300px;
              border: 1px solid #ddd;
              padding: 20px;
              background: white;
              box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
              position: relative;
            }
            .challan .heading {
              background-color: #2c3e50;
              color: white;
              padding: 8px 15px;
              text-align: center;
              font-weight: bold;
              margin: -20px -20px 15px -20px;
            }
            .challan h2 {
              text-align: center;
              color: #2c3e50;
              margin-bottom: 5px;
              font-size: 20px;
            }
            .challan h3 {
              text-align: center;
              color: #555;
              margin-bottom: 15px;
              font-size: 16px;
              font-weight: normal;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
            }
            table th {
              background-color: #f8f9fa;
              padding: 8px;
              text-align: left;
              border: 1px solid #ddd;
              font-weight: bold;
            }
            table td {
              padding: 8px;
              border: 1px solid #ddd;
            }
            table.no-border th,
            table.no-border td {
              border: none;
              padding: 4px 0;
            }
            .total {
              font-weight: bold;
              background-color: #f8f9fa;
            }
            .footer {
              font-size: 14px;
              margin-top: 15px;
              line-height: 1.4;
            }
            .stars {
              text-align: center;
              font-size: 24px;
              margin: 15px 0;
            }
            .no-print {
              display: none !important;
            }
            .voucher-number {
              font-weight: bold;
              color: #2c3e50;
              font-size: 16px;
            }
          </style>
        </head>
        <body>
          <div class="challan-container">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 100);
            };
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleDateString('en', { month: 'short' });
    const year = date.getFullYear().toString().slice(-2);
    return `${day} ${month} ${year}`;
  };

  const resetForm = () => {
    setFormData({
      studentId: '',
      studentName: '',
      program: '',
      semester: '',
      totalAmount: '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      description: 'Tuition Fee',
      installmentNumber: '1',
      paymentMode: 'Cash'
    });
    setStudentDetails(null);
    setFeeBreakdown([]);
    setPaymentHistory([]);
    setChallanGenerated(false);
    setChallanNumber(utils.generateChallanNumber());
    setVoucherNumber('');
  };

  const renderNewChallan = () => {
    const totalAmount = parseInt(formData.totalAmount || 0);
    
    return (
      <div className="challan-container" id="challan-preview">
        {/* Left: Account Office Copy */}
        <div className="challan">
          <div className="heading">AGS Account Office (Copy)</div>
          <h2>AGS College of Education</h2>
          <h3>Chakri Road Rawalpindi</h3>

          <table className="no-border">
            <tbody>
              <tr>
                <td><b>Payment Date:</b></td>
                <td>{formatDate(formData.issueDate)}</td>
              </tr>
              <tr>
                <td><b>Due Date:</b></td>
                <td>{formatDate(formData.dueDate)}</td>
              </tr>
              <tr>
                <td><b>Name:</b></td>
                <td>{formData.studentName}</td>
              </tr>
              <tr>
                <td><b>Student ID:</b></td>
                <td>{formData.studentId}</td>
              </tr>
              <tr>
                <td><b>Voucher No:</b></td>
                <td className="voucher-number">{voucherNumber}</td>
              </tr>
              <tr>
                <td><b>Program:</b></td>
                <td>{formData.program}</td>
              </tr>
              <tr>
                <td><b>Semester:</b></td>
                <td>{formData.semester}</td>
              </tr>
            </tbody>
          </table>

          <table>
            <thead>
              <tr>
                <th>Sr.No</th>
                <th>Description</th>
                <th>Rs.</th>
              </tr>
            </thead>
            <tbody>
              {feeBreakdown.map((item, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{item.description}</td>
                  <td>{item.amount?.toLocaleString() || '0'}</td>
                </tr>
              ))}
              {feeBreakdown.length === 0 && (
                <tr>
                  <td>1</td>
                  <td>{formData.description}</td>
                  <td>{totalAmount.toLocaleString()}</td>
                </tr>
              )}
              <tr>
                <td colSpan="2" className="total">Total Amount:</td>
                <td className="total">{totalAmount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <p className="footer">
            <b>Payment Mode:</b> {formData.paymentMode}<br />
            <b>Fee Extension:</b> Fee Not Extended<br />
            <b>Mode of Payment:</b><br />
            * Fee must be deposited till 8th of every month.<br />
            * After due date fine Rs.100/day.
          </p>
        </div>

        {/* Middle: Student Copy */}
        <div className="challan">
          <div className="heading">Student Copy</div>
          <h2>AGS College of Education</h2>
          <h3>Chakri Road Rawalpindi</h3>

          <table className="no-border">
            <tbody>
              <tr>
                <td><b>Payment Date:</b></td>
                <td>{formatDate(formData.issueDate)}</td>
              </tr>
              <tr>
                <td><b>Due Date:</b></td>
                <td>{formatDate(formData.dueDate)}</td>
              </tr>
              <tr>
                <td><b>Name:</b></td>
                <td>{formData.studentName}</td>
              </tr>
              <tr>
                <td><b>Student ID:</b></td>
                <td>{formData.studentId}</td>
              </tr>
              <tr>
                <td><b>Voucher No:</b></td>
                <td className="voucher-number">{voucherNumber}</td>
              </tr>
              <tr>
                <td><b>Program:</b></td>
                <td>{formData.program}</td>
              </tr>
              <tr>
                <td><b>Semester:</b></td>
                <td>{formData.semester}</td>
              </tr>
            </tbody>
          </table>

          <table>
            <thead>
              <tr>
                <th>Sr.No</th>
                <th>Description</th>
                <th>Rs.</th>
              </tr>
            </thead>
            <tbody>
              {feeBreakdown.map((item, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{item.description}</td>
                  <td>{item.amount?.toLocaleString() || '0'}</td>
                </tr>
              ))}
              {feeBreakdown.length === 0 && (
                <tr>
                  <td>1</td>
                  <td>{formData.description}</td>
                  <td>{totalAmount.toLocaleString()}</td>
                </tr>
              )}
              <tr>
                <td colSpan="2" className="total">Total Amount:</td>
                <td className="total">{totalAmount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <p className="footer">
            <b>Payment Mode:</b> {formData.paymentMode}<br />
            <b>Fee Extension:</b> Fee Not Extended<br />
            <b>Mode of Payment:</b><br />
            * Fee must be deposited till 8th of every month.<br />
            * After due date fine Rs.100/day.
          </p>
        </div>

        {/* Right: Student Paid Fee Detail */}
        <div className="challan">
          <div className="heading">Student Paid Fee Detail</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Installment</th>
                <th>Amount Paid</th>
              </tr>
            </thead>
            <tbody>
              {paymentHistory.length > 0 ? (
                paymentHistory.map((payment, index) => (
                  <tr key={index}>
                    <td>
                      {payment.paymentDate?.toDate ? formatDate(payment.paymentDate.toDate()) : 
                       payment.date || 'N/A'}
                    </td>
                    <td>{payment.installmentNumber || payment.description || 'Tuition Fee'}</td>
                    <td>{payment.amount?.toLocaleString() || '0'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', fontStyle: 'italic', padding: '10px' }}>
                    No payment history available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="stars">⭐⭐⭐⭐⭐</div>
          <p style={{textAlign: 'center', fontWeight: 'bold', margin: '10px 0'}}>
            {feeBreakdown.length > 0 ? feeBreakdown[0].description : formData.description}
          </p>
          <p style={{textAlign: 'center', fontWeight: 'bold', color: '#2c3e50'}}>
            Voucher: {voucherNumber}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="generate-challan">
      <h2>Generate Fee Challan</h2>
      
      {!challanGenerated ? (
        <>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit} className="challan-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="studentId">Student ID *</label>
                <div className="search-btn-container">
                  <input
                    type="text"
                    id="studentId"
                    name="studentId"
                    value={formData.studentId}
                    onChange={handleChange}
                    required
                    placeholder="Enter student ID"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleStudentSearch}
                    disabled={loading || !formData.studentId}
                    className="search-btn"
                  >
                    {loading ? '...' : 'Search'}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="challanNumber">Challan Number</label>
                <input
                  type="text"
                  id="challanNumber"
                  value={challanNumber}
                  disabled
                  style={{ backgroundColor: '#f0f0f0' }}
                />
              </div>
            </div>

            {studentDetails && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="studentName">Student Name</label>
                    <input
                      type="text"
                      id="studentName"
                      name="studentName"
                      value={formData.studentName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="installmentNumber">Installment Number *</label>
                    <select
                      id="installmentNumber"
                      name="installmentNumber"
                      value={formData.installmentNumber}
                      onChange={handleChange}
                      required
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="program">Program</label>
                    <input
                      type="text"
                      id="program"
                      name="program"
                      value={formData.program}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="semester">Semester</label>
                    <input
                      type="text"
                      id="semester"
                      name="semester"
                      value={formData.semester}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="totalAmount">Total Amount *</label>
                    <input
                      type="number"
                      id="totalAmount"
                      name="totalAmount"
                      value={formData.totalAmount}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="paymentMode">Payment Mode</label>
                    <select
                      id="paymentMode"
                      name="paymentMode"
                      value={formData.paymentMode}
                      onChange={handleChange}
                      required
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Online Payment">Online Payment</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="description">Fee Type</label>
                    <select
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      required
                    >
                      <option value="Tuition Fee">Tuition Fee</option>
                      <option value="Registration Fee">Registration Fee</option>
                      <option value="Exam Fee">Exam Fee</option>
                      <option value="University Fee">University Fee</option>
                      <option value="Other Fee">Other Fee</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="issueDate">Issue Date *</label>
                    <input
                      type="date"
                      id="issueDate"
                      name="issueDate"
                      value={formData.issueDate}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="dueDate">Due Date *</label>
                    <input
                      type="date"
                      id="dueDate"
                      name="dueDate"
                      value={formData.dueDate}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group full-width">
                    <label htmlFor="voucherNumber">Voucher Number (Auto-generated)</label>
                    <input
                      type="text"
                      id="voucherNumber"
                      value={voucherNumber}
                      disabled
                      style={{ 
                        backgroundColor: '#f0f0f0', 
                        fontWeight: 'bold',
                        fontSize: '16px',
                        color: '#2c3e50'
                      }}
                      placeholder="Voucher number will be auto-generated"
                    />
                    <small style={{color: '#666', fontStyle: 'italic'}}>
                      Format: Last 5 digits of Student ID + Month + Date + Installment Number
                    </small>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="submit-btn">
                  {loading ? 'Generating Challan...' : 'Generate Challan'}
                </button>
              </>
            )}
          </form>
        </>
      ) : (
        <>
          {renderNewChallan()}
          <div className="print-section no-print">
            <button onClick={handlePrint} className="print-btn">
              Print Challan
            </button>
            <button onClick={resetForm} className="new-challan-btn">
              Generate New Challan
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default GenerateChallan;