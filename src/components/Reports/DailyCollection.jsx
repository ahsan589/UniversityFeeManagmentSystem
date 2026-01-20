import React, { useState, useEffect } from 'react';
import { studentsService, paymentsService } from '../../services/firebaseService';
import './DailyCollection.css';

const DailyCollection = () => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDailyCollections();
  }, [selectedDate]);

  const loadDailyCollections = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('Loading collections for:', selectedDate);

      // Get all payments first
      const allPayments = await paymentsService.getAllPayments();
      console.log('Total payments found:', allPayments.length);

      if (!allPayments || allPayments.length === 0) {
        setCollections([]);
        setLoading(false);
        return;
      }

      // Filter payments for selected date
      const selectedDateObj = new Date(selectedDate);
      selectedDateObj.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(selectedDateObj);
      nextDay.setDate(nextDay.getDate() + 1);

      console.log('Filtering payments between:', selectedDateObj, 'and', nextDay);

      const dailyPayments = allPayments.filter(payment => {
        try {
          if (!payment.paymentDate) return false;
          
          let paymentDate;
          
          // Handle Firebase Timestamp
          if (payment.paymentDate.toDate) {
            paymentDate = payment.paymentDate.toDate();
          } else if (payment.paymentDate.seconds) {
            // If it's a Firestore timestamp object
            paymentDate = new Date(payment.paymentDate.seconds * 1000);
          } else if (typeof payment.paymentDate === 'string') {
            paymentDate = new Date(payment.paymentDate);
          } else if (payment.paymentDate instanceof Date) {
            paymentDate = payment.paymentDate;
          } else {
            console.log('Unknown date format:', payment.paymentDate);
            return false;
          }

          // Check if date is valid
          if (isNaN(paymentDate.getTime())) {
            console.log('Invalid date:', paymentDate);
            return false;
          }

          // Check if it's within selected day
          return paymentDate >= selectedDateObj && paymentDate < nextDay;
          
        } catch (error) {
          console.error('Error processing payment date:', error);
          return false;
        }
      });

      console.log('Daily payments found:', dailyPayments.length);

      // Get student details for these payments
      if (dailyPayments.length > 0) {
        const allStudents = await studentsService.getAllStudents();
        await processCollections(dailyPayments, allStudents);
      } else {
        setCollections([]);
      }

    } catch (error) {
      console.error('Error loading collections:', error);
      setError('Failed to load collection data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const processCollections = async (payments, students) => {
    const collectionsList = payments.map(payment => {
      try {
        // Find student for this payment
        const student = students.find(s => 
          s.id === payment.studentId || s.studentId === payment.studentId
        );

        // Format payment time
        let paymentDate;
        if (payment.paymentDate.toDate) {
          paymentDate = payment.paymentDate.toDate();
        } else if (payment.paymentDate.seconds) {
          paymentDate = new Date(payment.paymentDate.seconds * 1000);
        } else {
          paymentDate = new Date(payment.paymentDate);
        }

        const paymentTime = paymentDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        const formattedDate = paymentDate.toLocaleDateString('en-GB');

        return {
          id: payment.id || Math.random().toString(36).substr(2, 9),
          studentName: student?.name || payment.studentName || 'Unknown',
          studentId: student?.studentId || payment.studentId || 'N/A',
          amount: parseFloat(payment.amount || 0),
          paymentMethod: payment.paymentMethod || 'Cash',
          paymentTime: paymentTime,
          paymentDate: formattedDate,
          collectedBy: payment.collectedBy || 'Admin',
          challanNumber: payment.challanNumber || 'N/A',
          description: payment.description || 'Fee Payment'
        };

      } catch (error) {
        console.error('Error processing payment:', error);
        return null;
      }
    }).filter(item => item !== null);

    // Sort by time (latest first)
    collectionsList.sort((a, b) => {
      const timeA = a.paymentTime.toLowerCase();
      const timeB = b.paymentTime.toLowerCase();
      return timeB.localeCompare(timeA);
    });

    setCollections(collectionsList);
  };

  const totalCollection = collections.reduce((sum, item) => sum + item.amount, 0);
  const totalTransactions = collections.length;

  const formatCurrency = (amount) => {
    return `Rs${parseFloat(amount || 0).toLocaleString('en-IN')}`;
  };

  const getPaymentMethodClass = (method) => {
    const methodLower = (method || '').toLowerCase();
    if (methodLower.includes('cash')) return 'cash';
    if (methodLower.includes('online') || methodLower.includes('bank')) return 'online';
    if (methodLower.includes('card')) return 'card';
    if (methodLower.includes('cheque') || methodLower.includes('check')) return 'cheque';
    return 'other';
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading daily collections...</p>
      </div>
    );
  }

  return (
    <div className="daily-collection">
      <div className="page-header">
        <div className="header-left">
          <h1 className="page-title">Daily Collection Report</h1>
          <p className="page-subtitle">Fee payments received on selected date</p>
        </div>
        <div className="header-actions">
          <button onClick={loadDailyCollections} className="refresh-btn">
            <svg className="refresh-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="filter-section">
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="date-input"
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div className="filter-info">
            {collections.length > 0 ? (
              <span className="info-text">
                Showing {collections.length} transactions
              </span>
            ) : (
              <span className="info-text">No transactions found</span>
            )}
          </div>
        </div>
      </div>

      <div className="summary-section">
        <h2 className="section-title">Collection Summary</h2>
        <div className="summary-grid compact">
          <div className="summary-stat">
            <div className="stat-label">TRANSACTIONS</div>
            <div className="stat-value">{totalTransactions}</div>
          </div>
          
          <div className="summary-stat highlight">
            <div className="stat-label">TOTAL COLLECTION</div>
            <div className="stat-value">{formatCurrency(totalCollection)}</div>
          </div>
          
          <div className="summary-stat">
            <div className="stat-label">AVERAGE PAYMENT</div>
            <div className="stat-value">
              {totalTransactions > 0 ? formatCurrency(totalCollection / totalTransactions) : 'Rs0'}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-state">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="data-section">
        {collections.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <h3>No Collections Found</h3>
            <p>
              No payments were recorded on{' '}
              {new Date(selectedDate).toLocaleDateString('en-GB', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}.
            </p>
            <div className="empty-actions">
              <button 
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} 
                className="clear-btn"
              >
                View Today
              </button>
              <button 
                onClick={loadDailyCollections} 
                className="retry-btn"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="section-header">
              <h2 className="section-title">Payment Details</h2>
            </div>
            
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Date</th>
                    <th>Student ID</th>
                    <th>Student Name</th>
                    <th>Challan No</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Collected By</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.map(collection => (
                    <tr key={collection.id}>
                      <td className="time-cell">{collection.paymentTime}</td>
                      <td className="date-cell">{collection.paymentDate}</td>
                      <td className="student-id">{collection.studentId}</td>
                      <td className="student-name">{collection.studentName}</td>
                      <td className="challan-cell">{collection.challanNumber}</td>
                      <td className="amount-cell">{formatCurrency(collection.amount)}</td>
                      <td>
                        <span className={`method-badge ${getPaymentMethodClass(collection.paymentMethod)}`}>
                          {collection.paymentMethod}
                        </span>
                      </td>
                      <td className="collector-cell">{collection.collectedBy}</td>
                      <td className="desc-cell">{collection.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-footer">
              <div className="footer-left">
                <span className="transaction-count">{collections.length} transactions</span>
              </div>
              <div className="footer-right">
                <span className="total-label">Total Collection:</span>
                <span className="total-value">{formatCurrency(totalCollection)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DailyCollection;