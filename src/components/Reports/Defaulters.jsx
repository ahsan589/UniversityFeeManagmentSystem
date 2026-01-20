import React, { useState, useEffect } from 'react';
import { studentsService, challansService, paymentsService } from '../../services/firebaseService';
import './Defaulters.css';

const Defaulters = () => {
  const [defaulters, setDefaulters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    loadDefaulters();
  }, []);

  const loadDefaulters = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('Loading defaulters data...');

      // Get all data
      const [allStudents, allChallans, allPayments] = await Promise.all([
        studentsService.getAllStudents(),
        challansService.getAllChallans(),
        paymentsService.getAllPayments()
      ]);

      console.log('Data loaded:', {
        students: allStudents.length,
        challans: allChallans.length,
        payments: allPayments.length
      });

      // Debug first few records
      if (allStudents.length > 0) {
        console.log('Sample student:', allStudents[0]);
      }
      if (allChallans.length > 0) {
        console.log('Sample challan:', allChallans[0]);
      }
      if (allPayments.length > 0) {
        console.log('Sample payment:', allPayments[0]);
      }

      const defaultersList = await processDefaulters(allStudents, allChallans, allPayments);
      console.log('Processed defaulters:', defaultersList);
      
      setDefaulters(defaultersList);
      
    } catch (error) {
      console.error('Error loading defaulters:', error);
      setError(`Failed to load defaulters data: ${error.message}`);
      setDefaulters([]);
    } finally {
      setLoading(false);
    }
  };

  const processDefaulters = async (students, challans, payments) => {
    const today = new Date();
    const defaultersList = [];
    
    console.log('Processing defaulters logic...');

    // Create a map of student ID to student data
    const studentsMap = new Map();
    students.forEach(student => {
      // Store by document ID and also by studentId if available
      studentsMap.set(student.id, student);
      if (student.studentId) {
        studentsMap.set(student.studentId, student);
      }
    });

    // Calculate total paid per challan
    const challanPayments = {};
    payments.forEach(payment => {
      const challanId = payment.challanId;
      if (challanId) {
        if (!challanPayments[challanId]) {
          challanPayments[challanId] = 0;
        }
        challanPayments[challanId] += parseFloat(payment.amount || 0);
      }
    });

    console.log('Challan payments:', challanPayments);

    // Process each challan to find defaulters
    challans.forEach(challan => {
      try {
        console.log('Processing challan:', challan);

        // Check if challan is unpaid or partially paid
        const paidAmount = challanPayments[challan.id] || 0;
        const totalAmount = parseFloat(challan.totalAmount || challan.amount || 0);
        
        if (totalAmount <= 0) return;

        // Check if challan is fully paid
        if (paidAmount >= totalAmount) {
          console.log(`Challan ${challan.id} is fully paid: ${paidAmount}/${totalAmount}`);
          return;
        }

        // Check due date
        if (!challan.dueDate) {
          console.log(`Challan ${challan.id} has no due date`);
          return;
        }

        let dueDate;
        try {
          if (challan.dueDate.toDate) {
            dueDate = challan.dueDate.toDate();
          } else if (challan.dueDate.seconds) {
            dueDate = new Date(challan.dueDate.seconds * 1000);
          } else {
            dueDate = new Date(challan.dueDate);
          }
          
          if (isNaN(dueDate.getTime())) {
            console.log(`Invalid due date for challan ${challan.id}:`, challan.dueDate);
            return;
          }
        } catch (dateError) {
          console.error('Error parsing due date:', dateError);
          return;
        }

        // Check if payment is overdue
        if (dueDate >= today) {
          console.log(`Challan ${challan.id} is not overdue yet (due: ${dueDate})`);
          return;
        }

        // Find the student
        const studentId = challan.studentId;
        if (!studentId) {
          console.log(`Challan ${challan.id} has no studentId`);
          return;
        }

        const student = studentsMap.get(studentId);
        if (!student) {
          console.log(`Student not found for ID: ${studentId}`);
          return;
        }

        console.log(`Found overdue challan: ${challan.id} for student ${student.name}`);

        // Calculate days overdue
        const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        
        // Check if student is already in defaulters list
        const existingDefaulterIndex = defaultersList.findIndex(d => 
          d.studentId === studentId || d.studentDocId === student.id
        );

        if (existingDefaulterIndex >= 0) {
          // Update existing defaulter
          const existingDefaulter = defaultersList[existingDefaulterIndex];
          existingDefaulter.totalPendingAmount += (totalAmount - paidAmount);
          existingDefaulter.daysOverdue = Math.max(existingDefaulter.daysOverdue, daysOverdue);
          existingDefaulter.challansCount += 1;
          
          // Keep the earliest due date
          if (dueDate < new Date(existingDefaulter.earliestDueDate)) {
            existingDefaulter.earliestDueDate = dueDate;
          }
        } else {
          // Add new defaulter
          defaultersList.push({
            studentId: student.studentId || student.id,
            studentDocId: student.id,
            name: student.name || 'Unknown Student',
            program: student.program || 'Not Specified',
            semester: student.semester || 'N/A',
            totalPendingAmount: totalAmount - paidAmount,
            daysOverdue: daysOverdue,
            earliestDueDate: dueDate,
            challansCount: 1,
            totalAmount: totalAmount,
            paidAmount: paidAmount,
            unpaidAmount: totalAmount - paidAmount,
            challanNumber: challan.challanNumber || `CH-${challan.id?.slice(-6) || 'N/A'}`,
            dueDate: dueDate
          });
        }

      } catch (error) {
        console.error('Error processing challan:', error, challan);
      }
    });

    // Sort by days overdue (highest first)
    defaultersList.sort((a, b) => b.daysOverdue - a.daysOverdue);

    console.log('Final defaulters list:', defaultersList);
    return defaultersList.map((defaulter, index) => ({
      id: index + 1,
      ...defaulter
    }));
  };

  const filteredDefaulters = defaulters.filter(defaulter => {
    if (filter === 'all') return true;
    if (filter === '30days') return defaulter.daysOverdue <= 30;
    if (filter === '60days') return defaulter.daysOverdue > 30 && defaulter.daysOverdue <= 60;
    if (filter === '90days') return defaulter.daysOverdue > 60;
    return true;
  });

  const totalPending = filteredDefaulters.reduce((sum, defaulter) => sum + defaulter.totalPendingAmount, 0);
  const totalCritical = defaulters.filter(d => d.daysOverdue > 60).length;
  const totalWarning = defaulters.filter(d => d.daysOverdue > 30 && d.daysOverdue <= 60).length;

  const formatCurrency = (amount) => {
    return `Rs${parseFloat(amount || 0).toLocaleString('en-IN')}`;
  };

  const formatDate = (date) => {
    if (!date) return '-';
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return dateObj.toLocaleDateString('en-GB');
    } catch {
      return '-';
    }
  };

  const getStatusVariant = (daysOverdue) => {
    if (daysOverdue > 60) return 'critical';
    if (daysOverdue > 30) return 'warning';
    return 'moderate';
  };

  const getPaymentPercentage = (total, paid) => {
    if (total <= 0) return 0;
    return (paid / total) * 100;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading defaulters list...</p>
      </div>
    );
  }

  return (
    <div className="defaulters">
      <div className="page-header">
        <div className="header-left">
          <h1 className="page-title">Fee Defaulters Report</h1>
          <p className="page-subtitle">Students with unpaid challans after due date</p>
        </div>
        <div className="header-actions">
          <button onClick={loadDefaulters} className="refresh-btn">
            <svg className="refresh-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Refresh Data
          </button>
        </div>
      </div>

      {error && (
        <div className="error-state">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
          <button onClick={loadDefaulters} className="retry-btn">Try Again</button>
        </div>
      )}

      <div className="filter-section">
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">Filter by Overdue Period</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Defaulters ({defaulters.length})</option>
              <option value="30days">0-30 days overdue ({defaulters.filter(d => d.daysOverdue <= 30).length})</option>
              <option value="60days">31-60 days overdue ({defaulters.filter(d => d.daysOverdue > 30 && d.daysOverdue <= 60).length})</option>
              <option value="90days">Over 60 days overdue ({defaulters.filter(d => d.daysOverdue > 60).length})</option>
            </select>
          </div>
          <div className="filter-info">
            <span className="info-text">
              Showing {filteredDefaulters.length} of {defaulters.length} defaulters
              {totalPending > 0 && ` | Total Pending: ${formatCurrency(totalPending)}`}
            </span>
          </div>
        </div>
      </div>

      <div className="summary-section">
        <h2 className="section-title">Defaulter Summary</h2>
        <div className="summary-grid compact">
          <div className="summary-stat">
            <div className="stat-label">TOTAL DEFAULTERS</div>
            <div className="stat-value">{defaulters.length}</div>
          </div>
          
          <div className="summary-stat highlight">
            <div className="stat-label">TOTAL PENDING</div>
            <div className="stat-value">{formatCurrency(totalPending)}</div>
          </div>
          
          <div className="summary-stat">
            <div className="stat-label">CRITICAL CASES</div>
            <div className="stat-value critical">{totalCritical}</div>
          </div>
          
          <div className="summary-stat">
            <div className="stat-label">WARNING CASES</div>
            <div className="stat-value warning">{totalWarning}</div>
          </div>
        </div>
      </div>

      <div className="data-section">
        {filteredDefaulters.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <h3>No Defaulters Found</h3>
            <p>
              {defaulters.length === 0 
                ? "No students found with overdue payments. All challans may be paid or not yet due."
                : "No defaulters match the selected filter. Try selecting 'All Defaulters'."}
            </p>
            {defaulters.length > 0 && filteredDefaulters.length === 0 && (
              <div className="empty-actions">
                <button 
                  onClick={() => setFilter('all')} 
                  className="clear-btn"
                >
                  Show All Defaulters
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="section-header">
              <h2 className="section-title">Defaulters List</h2>
              <div className="section-subtitle">
                Showing students with unpaid challans after due date
              </div>
            </div>
            
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Student Name</th>
                    <th>Program</th>
                    <th>Challan No</th>
                    <th>Total Amount</th>
                    <th>Paid</th>
                    <th>Unpaid</th>
                    <th>Due Date</th>
                    <th>Days Overdue</th>
                    <th>Payment Status</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDefaulters.map(defaulter => {
                    const status = getStatusVariant(defaulter.daysOverdue);
                    const paymentPercent = getPaymentPercentage(defaulter.totalAmount, defaulter.paidAmount);
                    
                    return (
                      <tr key={defaulter.id}>
                        <td className="student-id">
                          {defaulter.studentId}
                          {defaulter.challansCount > 1 && (
                            <div className="challan-count-badge">
                              {defaulter.challansCount} challans
                            </div>
                          )}
                        </td>
                        <td className="student-name">{defaulter.name}</td>
                        <td className="program-cell">
                          {defaulter.program}
                          {defaulter.semester && defaulter.semester !== 'N/A' && ` - Sem ${defaulter.semester}`}
                        </td>
                        <td className="challan-cell">{defaulter.challanNumber}</td>
                        <td className="amount-cell">{formatCurrency(defaulter.totalAmount)}</td>
                        <td className="amount-cell paid">{formatCurrency(defaulter.paidAmount)}</td>
                        <td className="amount-cell unpaid">{formatCurrency(defaulter.unpaidAmount)}</td>
                        <td className="date-cell">{formatDate(defaulter.dueDate)}</td>
                        <td>
                          <span className={`days-badge ${status}`}>
                            {defaulter.daysOverdue} days
                          </span>
                        </td>
                        <td>
                          <div className="progress-cell">
                            <div className="progress-track">
                              <div 
                                className={`progress-fill ${status}`}
                                style={{ width: `${Math.min(paymentPercent, 100)}%` }}
                              ></div>
                            </div>
                            <span className="progress-value">{paymentPercent.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge ${status}`}>
                            {status === 'critical' ? 'Critical' : 
                             status === 'warning' ? 'Warning' : 'Moderate'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="table-footer">
              <div className="footer-left">
                <span className="transaction-count">
                  {filteredDefaulters.length} {filteredDefaulters.length === 1 ? 'defaulter' : 'defaulters'}
                </span>
              </div>
              <div className="footer-right">
                <span className="total-label">Total Unpaid Amount:</span>
                <span className="total-value unpaid">{formatCurrency(totalPending)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="legend-section">
        <div className="legend-title">Status Indicators</div>
        <div className="legend-content">
          <div className="legend-item">
            <div className="legend-indicator moderate"></div>
            <span className="legend-text">Moderate (≤30 days overdue)</span>
          </div>
          <div className="legend-item">
            <div className="legend-indicator warning"></div>
            <span className="legend-text">Warning (31-60 days overdue)</span>
          </div>
          <div className="legend-item">
            <div className="legend-indicator critical"></div>
            <span className="legend-text">Critical (&gt;60 days overdue)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Defaulters;