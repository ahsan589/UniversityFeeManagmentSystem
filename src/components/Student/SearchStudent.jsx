import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentsService, challansService, utils } from '../../services/firebaseService';
import './SearchStudent.css';

const SearchStudent = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [allStudents, setAllStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => {
    loadAllStudents();
  }, []);

  useEffect(() => {
    if (searchTerm.trim()) {
      filterStudents(searchTerm.trim());
    } else {
      setFilteredStudents(allStudents);
    }
  }, [searchTerm, allStudents]);

  const loadAllStudents = async () => {
    setLoading(true);
    try {
      const students = await studentsService.getAllStudents();
      
      const studentsWithFees = await Promise.all(
        students.map(async (student) => {
          try {
            // Get student's challans to determine actual payment status
            const allChallans = await challansService.getAllChallans();
            const studentChallans = allChallans.filter(challan => challan.studentId === student.id);
            
            // Use student's totalFee from student record as base
            const studentTotalFee = parseFloat(student.totalFee || 0);
            
            // Calculate fees based on ACTUAL challan data
            const totalFeesFromChallans = studentChallans.reduce((total, challan) => total + parseFloat(challan.totalAmount || 0), 0);
            const paidFeesFromChallans = studentChallans.reduce((total, challan) => total + parseFloat(challan.paidAmount || 0), 0);
            
            // Use the higher value between student record and challans
            const totalFees = Math.max(studentTotalFee, totalFeesFromChallans);
            const paidFees = paidFeesFromChallans;
            
            const dueFees = studentChallans.reduce((total, challan) => {
              // For paid challans, due should be 0
              if (challan.status === 'Paid') {
                return total + 0;
              }
              // For partial/unpaid, calculate actual due
              const challanTotal = parseFloat(challan.totalAmount || 0);
              const challanPaid = parseFloat(challan.paidAmount || 0);
              return total + (challanTotal - challanPaid);
            }, 0);
            
            // If no challans exist, use student total fee as due fee
            const finalDueFees = studentChallans.length > 0 ? dueFees : studentTotalFee - paidFees;
            
            // Use actual status from challans, or calculate based on fees
            const hasUnpaidChallans = studentChallans.some(challan => 
              challan.status === 'Unpaid' || challan.status === 'Partial'
            );
            
            let paymentStatus = 'Pending';
            if (studentChallans.length > 0) {
              paymentStatus = hasUnpaidChallans ? 'Pending' : 'Paid';
            } else {
              // No challans - check if student has fees to pay
              paymentStatus = studentTotalFee > 0 ? 'Pending' : 'Paid';
            }

            console.log(`Student ${student.name}: StudentTotalFee=${studentTotalFee}, ChallanTotal=${totalFeesFromChallans}, Paid=${paidFees}, Due=${finalDueFees}, Status=${paymentStatus}`);

            return {
              ...student,
              totalFees,
              paidFees,
              dueFees: finalDueFees,
              paymentStatus,
              hasChallans: studentChallans.length > 0,
              lastUpdated: new Date().toLocaleDateString()
            };
          } catch (error) {
            console.error(`Error calculating fees for student ${student.id}:`, error);
            // Fallback to student record data
            const studentTotalFee = parseFloat(student.totalFee || 0);
            return {
              ...student,
              totalFees: studentTotalFee,
              paidFees: 0,
              dueFees: studentTotalFee,
              paymentStatus: studentTotalFee > 0 ? 'Pending' : 'Paid',
              hasChallans: false,
              lastUpdated: new Date().toLocaleDateString()
            };
          }
        })
      );

      const sortedStudents = sortStudents(studentsWithFees, sortBy);
      setAllStudents(sortedStudents);
      setFilteredStudents(sortedStudents);
    } catch (error) {
      console.error('Error loading students:', error);
      setAllStudents([]);
      setFilteredStudents([]);
    }
    setLoading(false);
  };

  const filterStudents = async (term) => {
    setSearchLoading(true);
    try {
      let results = [];
      const lowerTerm = term.toLowerCase();

      results = allStudents.filter(student =>
        student.name?.toLowerCase().includes(lowerTerm) ||
        student.id?.toLowerCase().includes(lowerTerm) ||
        student.contact?.includes(term) ||
        student.fatherName?.toLowerCase().includes(lowerTerm) ||
        student.program?.toLowerCase().includes(lowerTerm) ||
        student.paymentStatus?.toLowerCase().includes(lowerTerm)
      );

      setFilteredStudents(results);
    } catch (error) {
      console.error('Error filtering students:', error);
      setFilteredStudents([]);
    }
    setSearchLoading(false);
  };

  const sortStudents = (students, sortField) => {
    return [...students].sort((a, b) => {
      switch (sortField) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'program':
          return (a.program || '').localeCompare(b.program || '');
        case 'fees':
          return (b.dueFees || 0) - (a.dueFees || 0);
        case 'id':
          return (a.id || '').localeCompare(b.id || '');
        default:
          return 0;
      }
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
  };

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  const handleSortChange = (field) => {
    setSortBy(field);
    const sorted = sortStudents(filteredStudents, field);
    setFilteredStudents(sorted);
  };

  const handleViewReport = (studentId) => {
    navigate(`/student-fee-report/${studentId}`);
  };

 const handleEditStudent = (studentId) => {
  navigate(`/edit-admission/${studentId}`);
};
  const formatValue = (value) => value || 'N/A';

  const getPaymentStatusBadge = (status, dueFees) => {
    const isPaid = status === 'Paid' || dueFees === 0;
    return (
      <span className={`status-badge ${isPaid ? 'status-paid' : 'status-pending'}`}>
        {isPaid ? 'Paid' : 'Pending'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="search-student">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h3>Loading Students</h3>
          <p>Please wait while we fetch student data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="search-student">
      <div className="page-header">
        <h2>Student Management</h2>
        <p className="page-subtitle">Search and manage student records and fee status</p>
      </div>

      <div className="search-section">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-container">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name, student ID, contact, father name, program, or payment status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={searchLoading}
            />
          </div>
          <div className="search-actions">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={searchLoading}
            >
              {searchLoading ? '🔄 Searching...' : '🔍 Search'}
            </button>
            {searchTerm && (
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={handleClearSearch}
              >
                ✕ Clear
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="results-section">
        <div className="results-header">
          <h3 className="results-title">
            {searchTerm ? 'Search Results' : 'All Students'}
          </h3>
          <div className="results-stats">
            <span className="results-count">
              📊 {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
            </span>
            
            <select 
              value={sortBy} 
              onChange={(e) => handleSortChange(e.target.value)}
              className="btn"
              style={{ background: 'white', border: '1px solid #e1e8ed' }}
            >
              <option value="name">Sort by Name</option>
              <option value="program">Sort by Program</option>
              <option value="fees">Sort by Due Fees</option>
              <option value="id">Sort by Student ID</option>
            </select>

            <div className="view-toggle">
              <button 
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                ◼️ Grid
              </button>
              <button 
                className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
              >
                ☰ Table
              </button>
            </div>
          </div>
        </div>

        {searchLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Searching students...</p>
          </div>
        ) : (
          <>
            {filteredStudents.length > 0 ? (
              <>
                {viewMode === 'grid' && (
                  <div className="results-grid">
                    {filteredStudents.map((student, index) => (
                      <div 
                        key={student.id} 
                        className="student-card"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <div className="student-header">
                          <div className="student-name-section">
                            <h4 className="student-name">{formatValue(student.name)}</h4>
                            <div className="student-meta">
                              <span className="student-id">ID: {student.id}</span>
                              {getPaymentStatusBadge(student.paymentStatus, student.dueFees)}
                              {!student.hasChallans && (
                                <span className="no-challan-badge">No Challan</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="student-details">
                          <div className="detail-row">
                            <span className="detail-label">Father:</span>
                            <span className="detail-value">{formatValue(student.fatherName)}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Contact:</span>
                            <span className="detail-value">{formatValue(student.contact)}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Program:</span>
                            <span className="detail-value">{formatValue(student.program)}</span>
                          </div>
                        </div>

                        <div className="fee-summary">
                          <div className="fee-row">
                            <div className="fee-item">
                              <span className="fee-label">Total Fee:</span>
                              <span className="fee-amount fee-total">
                                Rs. {student.totalFees.toLocaleString()}
                              </span>
                            </div>
                            <div className="fee-item">
                              <span className="fee-label">Paid Fee:</span>
                              <span className="fee-amount fee-paid">
                                Rs. {student.paidFees.toLocaleString()}
                              </span>
                            </div>
                            <div className="fee-item">
                              <span className="fee-label">Due Fee:</span>
                              <span className={`fee-amount ${student.dueFees > 0 ? 'fee-due' : 'fee-paid'}`}>
                                Rs. {student.dueFees.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="action-buttons">
                          <button
                            className="action-btn action-btn-primary"
                            onClick={() => handleViewReport(student.id)}
                          >
                            📊 Report
                          </button>
                          <button
                            className="action-btn action-btn-secondary"
                            onClick={() => handleEditStudent(student.id)}
                          >
                            ✏️ Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {viewMode === 'table' && (
                  <div className="table-container">
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th>Student Info</th>
                          <th>Contact</th>
                          <th>Program</th>
                          <th>Total Fee</th>
                          <th>Paid Fee</th>
                          <th>Due Fee</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student) => (
                          <tr key={student.id}>
                            <td>
                              <div>
                                <strong>{formatValue(student.name)}</strong>
                                <br />
                                <small>Father: {formatValue(student.fatherName)}</small>
                                <br />
                                <small className="student-id">ID: {student.id}</small>
                                <br />
                                {!student.hasChallans && (
                                  <small className="no-challan-text">No Challan Generated</small>
                                )}
                              </div>
                            </td>
                            <td>{formatValue(student.contact)}</td>
                            <td>{formatValue(student.program)}</td>
                            <td>Rs. {student.totalFees.toLocaleString()}</td>
                            <td>Rs. {student.paidFees.toLocaleString()}</td>
                            <td>
                              <strong className={student.dueFees > 0 ? 'fee-due' : 'fee-paid'}>
                                Rs. {student.dueFees.toLocaleString()}
                              </strong>
                            </td>
                            <td>
                              {getPaymentStatusBadge(student.paymentStatus, student.dueFees)}
                            </td>
                            <td>
                              <div className="table-actions">
                                <button
                                  className="action-btn action-btn-primary"
                                  onClick={() => handleViewReport(student.id)}
                                >
                                  📊
                                </button>
                                <button
                                  className="action-btn action-btn-secondary"
                                  onClick={() => handleEditStudent(student.id)}
                                >
                                  ✏️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🎓</div>
                <h3>No Students Found</h3>
                <p>
                  {searchTerm 
                    ? `No students match your search for "${searchTerm}". Try different keywords.` 
                    : 'No students found in the system. Add some students to get started.'
                  }
                </p>
                {!searchTerm && (
                  <button 
                    className="btn btn-primary"
                    onClick={() => navigate('/new-admission')}
                    style={{ marginTop: '1rem' }}
                  >
                    ➕ Add New Student
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SearchStudent;