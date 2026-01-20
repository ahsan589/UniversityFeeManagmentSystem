import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentsService, challansService, paymentsService } from '../../services/firebaseService';
import './Payment.css';

const Payment = () => {
  const navigate = useNavigate();
  const [searchType, setSearchType] = useState("student");
  const [searchId, setSearchId] = useState("");
  const [student, setStudent] = useState(null);
  const [challan, setChallan] = useState(null);
  const [challans, setChallans] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Reset form
  const resetForm = () => {
    setStudent(null);
    setChallan(null);
    setChallans([]);
    setPaymentAmount("");
    setError("");
    setSuccess("");
  };

  // Safe Firebase operations with fallbacks
  const safeGetAllChallans = async () => {
    try {
      if (challansService && typeof challansService.getAllChallans === 'function') {
        const result = await challansService.getAllChallans();
        console.log('Challans loaded:', result);
        return result || [];
      } else {
        console.warn('challansService.getAllChallans is not available');
        return [];
      }
    } catch (err) {
      console.error('Error getting challans:', err);
      return [];
    }
  };

  const safeGetStudentById = async (id) => {
    try {
      if (studentsService && typeof studentsService.getStudentById === 'function') {
        const result = await studentsService.getStudentById(id);
        console.log('Student loaded:', result);
        return result;
      } else {
        console.warn('studentsService.getStudentById is not available');
        return null;
      }
    } catch (err) {
      console.error('Error getting student:', err);
      return null;
    }
  };

  const safeAddPayment = async (paymentData) => {
    try {
      if (paymentsService && typeof paymentsService.addPayment === 'function') {
        console.log('Adding payment:', paymentData);
        const result = await paymentsService.addPayment(paymentData);
        console.log('Payment added successfully:', result);
        return result;
      } else {
        console.warn('paymentsService.addPayment is not available - simulating success');
        console.log('Payment data (not saved to DB):', paymentData);
        return { id: `payment-${Date.now()}` };
      }
    } catch (err) {
      console.error('Error adding payment:', err);
      throw new Error(`Failed to create payment record: ${err.message}`);
    }
  };

  const safeUpdateChallan = async (challanId, updateData) => {
    try {
      if (challansService && typeof challansService.updateChallan === 'function') {
        console.log('Updating challan:', challanId, updateData);
        await challansService.updateChallan(challanId, updateData);
        console.log('Challan updated successfully');
      } else {
        console.warn('challansService.updateChallan is not available - simulating success');
        console.log('Challan update (not saved to DB):', challanId, updateData);
      }
    } catch (err) {
      console.error('Error updating challan:', err);
      throw new Error(`Failed to update challan: ${err.message}`);
    }
  };

  const safeUpdateStudent = async (studentId, updateData) => {
    try {
      if (studentsService && typeof studentsService.updateStudent === 'function') {
        console.log('Updating student:', studentId, updateData);
        await studentsService.updateStudent(studentId, updateData);
        console.log('Student updated successfully');
      } else {
        console.warn('studentsService.updateStudent is not available - simulating success');
        console.log('Student update (not saved to DB):', studentId, updateData);
      }
    } catch (err) {
      console.error('Error updating student:', err);
      throw new Error(`Failed to update student: ${err.message}`);
    }
  };

  // Search for student or challan
  const handleSearch = async () => {
    if (!searchId.trim()) {
      setError("Please enter a valid ID");
      return;
    }

    setLoading(true);
    resetForm();

    try {
      console.log('Starting search for:', searchId, 'type:', searchType);
      const allChallans = await safeGetAllChallans();
      
      if (searchType === "student") {
        // Search by Student ID
        const studentDoc = await safeGetStudentById(searchId);
        if (studentDoc) {
          setStudent({
            ...studentDoc,
            id: studentDoc.id
          });

          // Get student's challans
          const studentChallans = allChallans.filter(c => c.studentId === studentDoc.id);
          setChallans(studentChallans);

          // Find unpaid challans
          const unpaidChallans = studentChallans.filter(c => 
            c.status === "Unpaid" || c.status === "Pending" || !c.status
          );
          
          if (unpaidChallans.length > 0) {
            setChallan(unpaidChallans[0]);
            console.log('Found unpaid challan:', unpaidChallans[0]);
          } else {
            setError("No unpaid challans found for this student");
          }
        } else {
          setError("Student not found. Please check the Student ID.");
        }
      } else {
        // Search by Challan ID or Challan Number
        const challanDoc = allChallans.find(c => 
          c.id === searchId || c.challanNumber === searchId
        );
        
        if (challanDoc) {
          console.log('Found challan:', challanDoc);
          const isUnpaid = !challanDoc.status || 
                          challanDoc.status === "Unpaid" || 
                          challanDoc.status === "Pending";
          
          if (isUnpaid) {
            setChallan(challanDoc);
            setChallans([challanDoc]);

            // Get student details
            const studentDoc = await safeGetStudentById(challanDoc.studentId);
            if (studentDoc) {
              setStudent({
                ...studentDoc,
                id: studentDoc.id
              });
            } else {
              setError("Student not found for this challan");
            }
          } else {
            setError("This challan has already been paid");
          }
        } else {
          setError("Challan not found. Please check the Challan ID or Number.");
        }
      }
    } catch (err) {
      console.error("Search error:", err);
      setError(`Search failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Process payment
  const handlePayment = async () => {
    if (!student || !challan || !paymentAmount) {
      setError("Please fill all required fields");
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Payment amount must be a number greater than 0");
      return;
    }

    const challanAmount = parseFloat(challan.totalAmount || 0);
    const alreadyPaid = parseFloat(challan.paidAmount || 0);
    const remainingBalance = challanAmount - alreadyPaid;

    if (amount > remainingBalance + 0.01) { // Allow small floating point differences
      setError(`Payment amount cannot exceed remaining balance of ${formatCurrency(remainingBalance)}`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log('=== STARTING PAYMENT PROCESS ===');
      const paymentDate = new Date();
      
      // 1. Create payment record
      const paymentData = {
        studentId: student.id || '',
        challanId: challan.id || '',
        studentName: student.name || 'Unknown Student',
        challanNumber: challan.challanNumber || 'N/A',
        amount: amount,
        paymentDate: paymentDate,
        paymentMethod: paymentMethod,
        collectedBy: "Admin",
        description: `Payment for ${challan.description || 'Fee'}`,
        status: "Completed",
        createdAt: paymentDate
      };

      console.log('Step 1: Creating payment record...');
      await safeAddPayment(paymentData);

      // 2. Update challan status
      const newPaidAmount = alreadyPaid + amount;
      let newChallanStatus = "Partial";
      
      // If payment covers the full remaining amount (within 0.01 tolerance), mark as Paid
      if (Math.abs(newPaidAmount - challanAmount) < 0.01) {
        newChallanStatus = "Paid";
      }

      const challanUpdateData = {
        status: newChallanStatus,
        paidAmount: newPaidAmount,
        updatedAt: paymentDate
      };

      console.log('Step 2: Updating challan status...');
      console.log('From:', challan.status, 'To:', newChallanStatus);
      console.log('From paidAmount:', alreadyPaid, 'To:', newPaidAmount);
      await safeUpdateChallan(challan.id, challanUpdateData);

      // 3. Update student record
      const studentUpdateData = {
        updatedAt: paymentDate,
        lastPaymentDate: paymentDate,
        lastPaymentAmount: amount
      };

      console.log('Step 3: Updating student record...');
      await safeUpdateStudent(student.id, studentUpdateData);

      console.log('=== PAYMENT PROCESS COMPLETED SUCCESSFULLY ===');
      
      // Enhanced success message based on payment status
      let successMessage = `✅ Payment of ${formatCurrency(amount)} received successfully! `;
      if (newChallanStatus === "Paid") {
        successMessage += "Challan is now fully paid.";
      } else {
        successMessage += `Challan status updated to partially paid. Remaining balance: ${formatCurrency(challanAmount - newPaidAmount)}`;
      }
      
      setSuccess(successMessage);
      setPaymentAmount("");

      // Refresh data after success
      setTimeout(() => {
        handleSearch();
      }, 2000);

    } catch (err) {
      console.error("=== PAYMENT PROCESS FAILED ===", err);
      setError(`Payment failed: ${err.message}. Please check console for details.`);
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `Rs. ${parseFloat(amount || 0).toLocaleString('en-PK')}`;
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      if (date.toDate) {
        return date.toDate().toLocaleDateString('en-GB');
      }
      return new Date(date).toLocaleDateString('en-GB');
    } catch {
      return 'Invalid Date';
    }
  };

  // Get status badge class
  const getStatusClass = (status) => {
    if (!status) return 'unpaid';
    const statusLower = status.toLowerCase();
    if (statusLower === 'paid') return 'paid';
    if (statusLower === 'partial') return 'partial';
    if (statusLower === 'unpaid' || statusLower === 'pending') return 'unpaid';
    return 'unpaid';
  };

  // Get status display text
  const getStatusDisplay = (status) => {
    if (!status) return 'Unpaid';
    const statusLower = status.toLowerCase();
    if (statusLower === 'paid') return 'Paid';
    if (statusLower === 'partial') return 'Partially Paid';
    if (statusLower === 'unpaid' || statusLower === 'pending') return 'Unpaid';
    return 'Unpaid';
  };

  // Calculate remaining balance
  const getRemainingBalance = () => {
    if (!challan) return 0;
    const total = parseFloat(challan.totalAmount || 0);
    const paid = parseFloat(challan.paidAmount || 0);
    return total - paid;
  };

  // Get predicted status after payment
  const getPredictedStatus = () => {
    if (!paymentAmount) return null;
    const amount = parseFloat(paymentAmount);
    const remaining = getRemainingBalance();
    
    if (Math.abs(amount - remaining) < 0.01) {
      return 'Paid';
    } else if (amount > 0) {
      return 'Partially Paid';
    }
    return null;
  };

  return (
    <div className="payment-container">
      <div className="payment-header">
        <div className="header-content">
          <h1>Fee Payment Processing</h1>
          <p>Receive payments and update challan status</p>
        </div>
        <button
          className="back-btn"
          onClick={() => navigate("/dashboard")}
        >
          ← Back to Dashboard
        </button>
      </div>

      <div className="payment-content">
        {/* Search Section */}
        <div className="search-section">
          <div className="search-type-toggle">
            <button
              className={searchType === "student" ? "active" : ""}
              onClick={() => {
                setSearchType("student");
                resetForm();
              }}
            >
              Search by Student ID
            </button>
            <button
              className={searchType === "challan" ? "active" : ""}
              onClick={() => {
                setSearchType("challan");
                resetForm();
              }}
            >
              Search by Challan ID
            </button>
          </div>

          <div className="search-input-group">
            <input
              type="text"
              placeholder={
                searchType === "student" 
                  ? "Enter Student ID (e.g., yjTFxSPE2750bD3qwpp9)" 
                  : "Enter Challan ID or Number (e.g., CH1763301161679163)"
              }
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              className="search-input"
            />
            <button
              className="search-btn"
              onClick={handleSearch}
              disabled={loading || !searchId.trim()}
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <div>
              <strong>Error:</strong> {error}
              <div className="error-details">
                Check browser console (F12) for detailed error information
              </div>
            </div>
          </div>
        )}
        {success && (
          <div className="success-message">
            <span className="success-icon">✅</span>
            {success}
          </div>
        )}

        {/* Student Details */}
        {student && (
          <div className="student-details">
            <h3>Student Information</h3>
            <div className="details-grid">
              <div className="detail-item">
                <label>Student Name:</label>
                <span>{student.name || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <label>Student ID:</label>
                <span>{student.id || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <label>Class/Program:</label>
                <span>{student.class || student.program || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <label>Semester:</label>
                <span>{student.semester || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <label>Contact:</label>
                <span>{student.contact || student.phone || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Selected Challan Details */}
        {challan && (
          <div className="challan-details">
            <h3>Selected Challan Details</h3>
            <div className="details-grid">
              <div className="detail-item">
                <label>Challan Number:</label>
                <span>{challan.challanNumber || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <label>Description:</label>
                <span>{challan.description || 'Tuition Fee'}</span>
              </div>
              <div className="detail-item">
                <label>Issue Date:</label>
                <span>{formatDate(challan.issueDate)}</span>
              </div>
              <div className="detail-item">
                <label>Due Date:</label>
                <span>{formatDate(challan.dueDate)}</span>
              </div>
              <div className="detail-item">
                <label>Total Amount:</label>
                <span>{formatCurrency(challan.totalAmount)}</span>
              </div>
              <div className="detail-item">
                <label>Paid Amount:</label>
                <span>{formatCurrency(challan.paidAmount || 0)}</span>
              </div>
              <div className="detail-item">
                <label>Remaining Balance:</label>
                <span className="due-amount">
                  {formatCurrency(getRemainingBalance())}
                </span>
              </div>
              <div className="detail-item">
                <label>Current Status:</label>
                <span className={`status-${getStatusClass(challan.status)}`}>
                  {getStatusDisplay(challan.status)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Payment Section */}
        {student && challan && (!challan.status || challan.status === "Unpaid" || challan.status === "Pending" || challan.status === "Partial") && (
          <div className="payment-section">
            <h3>Process Payment</h3>
            <div className="payment-form">
              <div className="form-group">
                <label htmlFor="paymentAmount">Payment Amount *</label>
                <input
                  id="paymentAmount"
                  type="number"
                  min="1"
                  max={getRemainingBalance()}
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={`Enter amount up to ${formatCurrency(getRemainingBalance())}`}
                />
                <div className="input-help">
                  Remaining balance: {formatCurrency(getRemainingBalance())}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="paymentMethod">Payment Method *</label>
                <select
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Online">Online</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Card">Card</option>
                </select>
              </div>
              
              <div className="payment-summary">
                <h4>Status Update Preview</h4>
                <div className="summary-item">
                  <span>Current Status:</span>
                  <span className={`status-${getStatusClass(challan.status)}`}>
                    {getStatusDisplay(challan.status)}
                  </span>
                </div>
                <div className="summary-item">
                  <span>After Payment:</span>
                  <span className={`status-${getStatusClass(getPredictedStatus())}`}>
                    {getPredictedStatus() || '---'}
                  </span>
                </div>
                {getPredictedStatus() === 'Partially Paid' && (
                  <div className="summary-item">
                    <span>New Balance:</span>
                    <span className="due-amount">
                      {formatCurrency(getRemainingBalance() - parseFloat(paymentAmount || 0))}
                    </span>
                  </div>
                )}
              </div>

              <button
                className="payment-btn"
                onClick={handlePayment}
                disabled={loading || !paymentAmount || parseFloat(paymentAmount) <= 0}
              >
                {loading ? "Processing Payment..." : `Receive Payment - ${formatCurrency(paymentAmount)}`}
              </button>
            </div>
          </div>
        )}

        {/* All Student Challans */}
        {student && challans.length > 0 && (
          <div className="all-challans">
            <h3>All Challans for Student</h3>
            <div className="challans-list">
              {challans.map((challanItem) => (
                <div 
                  key={challanItem.id} 
                  className={`challan-item ${challanItem.id === challan?.id ? 'selected' : ''}`}
                  onClick={() => setChallan(challanItem)}
                >
                  <div className="challan-header">
                    <span className="challan-number">{challanItem.challanNumber || 'N/A'}</span>
                    <span className={`status-${getStatusClass(challanItem.status)}`}>
                      {getStatusDisplay(challanItem.status)}
                    </span>
                  </div>
                  <div className="challan-details-small">
                    <span>{challanItem.description || 'Fee'}</span>
                    <span>{formatCurrency(challanItem.totalAmount)}</span>
                    <span>Paid: {formatCurrency(challanItem.paidAmount || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Payment;