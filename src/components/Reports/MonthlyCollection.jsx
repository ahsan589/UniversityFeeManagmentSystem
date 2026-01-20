import React, { useState, useEffect } from 'react';
import { paymentsService, studentsService } from '../../services/firebaseService';
import './MonthlyCollection.css';

const MonthlyCollection = () => {
  const [collections, setCollections] = useState([]);
  const [dailyBreakdown, setDailyBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [error, setError] = useState('');

  useEffect(() => {
    loadMonthlyCollections();
  }, [selectedMonth, selectedYear]);

  const loadMonthlyCollections = async () => {
    try {
      setLoading(true);
      setError('');

      console.log(`Loading collections for ${selectedMonth}/${selectedYear}`);

      // Get all payments
      const allPayments = await paymentsService.getAllPayments();
      console.log('Total payments found:', allPayments.length);

      if (!allPayments || allPayments.length === 0) {
        setCollections([]);
        setDailyBreakdown([]);
        setLoading(false);
        return;
      }

      // Get all students for reference
      const allStudents = await studentsService.getAllStudents();

      // Process monthly data
      processMonthlyData(allPayments, allStudents);

    } catch (error) {
      console.error('Error loading monthly collections:', error);
      setError('Failed to load monthly collection data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const processMonthlyData = (payments, students) => {
    // Filter payments for selected month
    const selectedMonthStart = new Date(selectedYear, selectedMonth - 1, 1);
    const selectedMonthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);

    console.log('Filtering between:', selectedMonthStart, 'and', selectedMonthEnd);

    const monthlyPayments = payments.filter(payment => {
      try {
        if (!payment.paymentDate) return false;
        
        let paymentDate;
        
        // Handle Firebase timestamp
        if (payment.paymentDate.toDate) {
          paymentDate = payment.paymentDate.toDate();
        } else if (payment.paymentDate.seconds) {
          paymentDate = new Date(payment.paymentDate.seconds * 1000);
        } else if (typeof payment.paymentDate === 'string') {
          paymentDate = new Date(payment.paymentDate);
        } else if (payment.paymentDate instanceof Date) {
          paymentDate = payment.paymentDate;
        } else {
          return false;
        }

        if (isNaN(paymentDate.getTime())) return false;

        return paymentDate >= selectedMonthStart && paymentDate <= selectedMonthEnd;
        
      } catch (error) {
        console.error('Error filtering payment:', error);
        return false;
      }
    });

    console.log('Monthly payments:', monthlyPayments.length);

    if (monthlyPayments.length === 0) {
      setCollections([]);
      setDailyBreakdown([]);
      return;
    }

    // Process daily breakdown
    const dailyData = processDailyBreakdown(monthlyPayments);
    setDailyBreakdown(dailyData);

    // Process detailed collections
    const processedCollections = processCollections(monthlyPayments, students);
    setCollections(processedCollections);
  };

  const processDailyBreakdown = (payments) => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const dailyTotals = {};

    // Initialize all days with 0
    for (let day = 1; day <= daysInMonth; day++) {
      dailyTotals[day] = { amount: 0, count: 0 };
    }

    // Calculate daily totals
    payments.forEach(payment => {
      try {
        let paymentDate;
        if (payment.paymentDate.toDate) {
          paymentDate = payment.paymentDate.toDate();
        } else if (payment.paymentDate.seconds) {
          paymentDate = new Date(payment.paymentDate.seconds * 1000);
        } else {
          paymentDate = new Date(payment.paymentDate);
        }

        const day = paymentDate.getDate();
        const amount = parseFloat(payment.amount || 0);

        if (dailyTotals[day]) {
          dailyTotals[day].amount += amount;
          dailyTotals[day].count += 1;
        }
      } catch (error) {
        console.error('Error processing payment for daily breakdown:', error);
      }
    });

    // Convert to array format
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return {
        day,
        amount: dailyTotals[day].amount,
        count: dailyTotals[day].count,
        date: new Date(selectedYear, selectedMonth - 1, day)
      };
    });
  };

  const processCollections = (payments, students) => {
    return payments.map(payment => {
      try {
        // Find student for this payment
        const student = students.find(s => 
          s.id === payment.studentId || s.studentId === payment.studentId
        );

        // Format payment date and time
        let paymentDate = '';
        let paymentTime = '';
        try {
          let payDate;
          if (payment.paymentDate.toDate) {
            payDate = payment.paymentDate.toDate();
          } else if (payment.paymentDate.seconds) {
            payDate = new Date(payment.paymentDate.seconds * 1000);
          } else {
            payDate = new Date(payment.paymentDate);
          }
          
          paymentDate = payDate.toLocaleDateString('en-GB');
          paymentTime = payDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
        } catch (timeError) {
          console.error('Error formatting payment datetime:', timeError);
        }

        return {
          id: payment.id,
          studentName: student?.name || payment.studentName || 'Unknown',
          studentId: student?.studentId || payment.studentId || 'N/A',
          amount: parseFloat(payment.amount || 0),
          paymentMethod: payment.paymentMethod || 'Cash',
          paymentDate,
          paymentTime,
          collectedBy: payment.collectedBy || 'Admin',
          challanNumber: payment.challanNumber || 'N/A',
          description: payment.description || 'Fee Payment'
        };
      } catch (error) {
        console.error('Error processing payment:', error);
        return null;
      }
    }).filter(collection => collection !== null)
      .sort((a, b) => {
        // Sort by date and time (newest first)
        const dateA = new Date(a.paymentDate + ' ' + a.paymentTime);
        const dateB = new Date(b.paymentDate + ' ' + b.paymentTime);
        return dateB - dateA;
      });
  };

  const totalCollection = dailyBreakdown.reduce((sum, day) => sum + day.amount, 0);
  const totalTransactions = dailyBreakdown.reduce((sum, day) => sum + day.count, 0);
  const daysWithCollection = dailyBreakdown.filter(day => day.count > 0).length;

  const formatCurrency = (amount) => {
    return `Rs${parseFloat(amount || 0).toLocaleString('en-IN')}`;
  };

  const handleMonthChange = (e) => {
    setSelectedMonth(parseInt(e.target.value));
  };

  const handleYearChange = (e) => {
    setSelectedYear(parseInt(e.target.value));
  };

  const getPaymentMethodClass = (method) => {
    const methodLower = (method || '').toLowerCase();
    if (methodLower.includes('cash')) return 'cash';
    if (methodLower.includes('online') || methodLower.includes('bank')) return 'online';
    if (methodLower.includes('card')) return 'card';
    if (methodLower.includes('cheque') || methodLower.includes('check')) return 'cheque';
    return 'other';
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading monthly collections...</p>
      </div>
    );
  }

  return (
    <div className="monthly-collection">
      <div className="page-header">
        <div className="header-left">
          <h1 className="page-title">Monthly Collection Report</h1>
          <p className="page-subtitle">Fee payments received during selected month</p>
        </div>
        <div className="header-actions">
          <button onClick={loadMonthlyCollections} className="refresh-btn">
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
            <label className="filter-label">Select Month</label>
            <select
              value={selectedMonth}
              onChange={handleMonthChange}
              className="month-select"
            >
              {monthNames.map((month, index) => (
                <option key={index} value={index + 1}>{month}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Select Year</label>
            <select
              value={selectedYear}
              onChange={handleYearChange}
              className="year-select"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
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

      {error && (
        <div className="error-state">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="summary-section">
        <h2 className="section-title">Monthly Summary</h2>
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
            <div className="stat-label">COLLECTION DAYS</div>
            <div className="stat-value">{daysWithCollection}</div>
          </div>
          
          <div className="summary-stat">
            <div className="stat-label">AVERAGE PER DAY</div>
            <div className="stat-value">
              {daysWithCollection > 0 ? formatCurrency(totalCollection / daysWithCollection) : 'Rs0'}
            </div>
          </div>
        </div>
      </div>

      <div className="data-section">
        {collections.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1">
                <path d="M3 3h18v18H3z"/>
                <path d="M3 7h18M3 11h18M3 15h18M3 19h18"/>
              </svg>
            </div>
            <h3>No Collections Found</h3>
            <p>
              No payments were recorded in {monthNames[selectedMonth - 1]} {selectedYear}.
            </p>
          </div>
        ) : (
          <>
            <div className="section-header">
              <h2 className="section-title">Daily Breakdown - {monthNames[selectedMonth - 1]} {selectedYear}</h2>
            </div>
            
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Transactions</th>
                    <th>Amount</th>
                    <th>Daily Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyBreakdown.map((dayData) => {
                    const maxAmount = Math.max(...dailyBreakdown.map(d => d.amount || 1));
                    return (
                      <tr key={dayData.day}>
                        <td className="date-cell">
                          {dayData.date.toLocaleDateString('en-GB', { 
                            day: '2-digit', 
                            month: 'short' 
                          })}
                        </td>
                        <td className="day-cell">
                          {dayData.date.toLocaleDateString('en-GB', { weekday: 'short' })}
                        </td>
                        <td className="count-cell">{dayData.count}</td>
                        <td className="amount-cell">{formatCurrency(dayData.amount)}</td>
                        <td>
                          <div className="progress-cell">
                            <div className="progress-track">
                              <div 
                                className="progress-fill"
                                style={{
                                  width: `${(dayData.amount / maxAmount) * 100}%`
                                }}
                              ></div>
                            </div>
                            <span className="progress-value">
                              {dayData.amount > 0 ? formatCurrency(dayData.amount) : 'No collection'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="section-header">
              <h2 className="section-title">Detailed Transactions</h2>
            </div>
            
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
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
                      <td className="date-cell">{collection.paymentDate}</td>
                      <td className="time-cell">{collection.paymentTime}</td>
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
          </>
        )}
      </div>
    </div>
  );
};

export default MonthlyCollection;