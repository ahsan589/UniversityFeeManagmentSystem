import React, { useState, useEffect } from 'react';
import { studentsService, paymentsService } from '../../services/firebaseService';
import './ClassWiseReports.css';

const ClassWiseReports = () => {
  const [classData, setClassData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProgram, setSelectedProgram] = useState('');

  useEffect(() => {
    fetchClassWiseData();
  }, []);

  const fetchClassWiseData = async () => {
    try {
      setLoading(true);
      
      
      const allStudents = await studentsService.getAllStudents();
      const allPayments = await paymentsService.getAllPayments();
      
      // Group students by program
      const studentsByProgram = {};
      
      allStudents.forEach(student => {
        const program = student.program || 'Unknown Program';
        
        if (!studentsByProgram[program]) {
          studentsByProgram[program] = {
            students: [],
            totalFees: 0,
            collectedFees: 0,
            pendingFees: 0
          };
        }
        
        studentsByProgram[program].students.push(student);
      });
      
      // Calculate statistics for each program
      const classDataArray = [];
      
      for (const [program, data] of Object.entries(studentsByProgram)) {
        const students = data.students;
        let totalFees = 0;
        let collectedFees = 0;
        let defaultersCount = 0;
        
        for (const student of students) {
          const studentTotalFees = calculateTotalFees(student);
          totalFees += studentTotalFees;
          
          const studentPayments = allPayments.filter(payment => 
            payment.studentId === (student.studentId || student.id)
          );
          
          const paidAmount = studentPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
          collectedFees += paidAmount;
          
          if (studentTotalFees > 0 && paidAmount < (studentTotalFees * 0.5)) {
            defaultersCount++;
          }
        }
        
        const pendingFees = Math.max(0, totalFees - collectedFees);
        const collectionRate = totalFees > 0 ? (collectedFees / totalFees) * 100 : 0;
        
        classDataArray.push({
          program: program,
          totalStudents: students.length,
          totalFees: totalFees,
          collectedFees: collectedFees,
          pendingFees: pendingFees,
          defaulters: defaultersCount,
          collectionRate: collectionRate
        });
      }
      
      classDataArray.sort((a, b) => a.program.localeCompare(b.program));
      setClassData(classDataArray);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const calculateTotalFees = (student) => {
    const calculatedFees = (
      (student.registrationFee || 0) +
      (student.tuitionFee || 0) +
      (student.examFee || 0) +
      (student.universityShare || 0) +
      (student.others || 0)
    );
    
    return student.totalFee || calculatedFees;
  };

  const filteredData = selectedProgram
    ? classData.filter(item => item.program === selectedProgram)
    : classData;

  const totalStats = classData.reduce(
    (acc, item) => ({
      totalStudents: acc.totalStudents + item.totalStudents,
      totalFees: acc.totalFees + item.totalFees,
      collectedFees: acc.collectedFees + item.collectedFees,
      pendingFees: acc.pendingFees + item.pendingFees,
      defaulters: acc.defaulters + item.defaulters,
    }),
    { totalStudents: 0, totalFees: 0, collectedFees: 0, pendingFees: 0, defaulters: 0 }
  );

  const programs = [...new Set(classData.map(item => item.program))].sort();

  const getProgramStatus = (collectionRate) => {
    if (collectionRate >= 90) return 'excellent';
    if (collectionRate >= 75) return 'good';
    if (collectionRate >= 50) return 'average';
    return 'poor';
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p className="loading-text">Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="class-wise-reports">
      <div className="page-header">
        <div className="header-left">
          <h1 className="page-title">Program-wise Fee Reports</h1>
          <p className="page-subtitle">View and analyze fee collection by program</p>
        </div>
        <div className="header-actions">
          <button onClick={fetchClassWiseData} className="refresh-btn">
            <svg className="refresh-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Refresh Data
          </button>
        </div>
      </div>

      <div className="filter-section">
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">Filter by Program</label>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="program-select"
            >
              <option value="">All Programs</option>
              {programs.map(program => (
                <option key={program} value={program}>{program}</option>
              ))}
            </select>
          </div>
          <div className="filter-info">
            <span className="info-text">Showing {filteredData.length} of {classData.length} programs</span>
          </div>
        </div>
      </div>

      <div className="summary-section">
        <h2 className="section-title">Overall Summary</h2>
        <div className="summary-grid compact">
          <div className="summary-stat">
            <div className="stat-label">PROGRAMS</div>
            <div className="stat-value">{programs.length}</div>
          </div>
          
          <div className="summary-stat">
            <div className="stat-label">TOTAL STUDENTS</div>
            <div className="stat-value">{totalStats.totalStudents}</div>
          </div>
          
          <div className="summary-stat">
            <div className="stat-label">TOTAL FEES</div>
            <div className="stat-value">Rs{totalStats.totalFees.toLocaleString('en-IN')}</div>
          </div>
          
          <div className="summary-stat highlight">
            <div className="stat-label">COLLECTED</div>
            <div className="stat-value collected">Rs{totalStats.collectedFees.toLocaleString('en-IN')}</div>
          </div>
          
          <div className="summary-stat">
            <div className="stat-label">PENDING</div>
            <div className="stat-value pending">Rs{totalStats.pendingFees.toLocaleString('en-IN')}</div>
          </div>
          
          <div className="summary-stat">
            <div className="stat-label">DEFAULTERS</div>
            <div className="stat-value defaulters">{totalStats.defaulters}</div>
          </div>
          
          <div className="summary-stat highlight">
            <div className="stat-label">COLLECTION RATE</div>
            <div className={`stat-value ${getProgramStatus((totalStats.collectedFees / totalStats.totalFees) * 100)}`}>
              {totalStats.totalFees > 0 ? 
                ((totalStats.collectedFees / totalStats.totalFees) * 100).toFixed(1) + '%' : 
                '0%'}
            </div>
          </div>
        </div>
      </div>

      <div className="data-section">
        <div className="section-header">
          <h2 className="section-title">Program Details</h2>
        </div>
        
        {filteredData.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Program</th>
                  <th>Students</th>
                  <th>Total Fees</th>
                  <th>Collected</th>
                  <th>Pending</th>
                  <th>Defaulters</th>
                  <th>Collection</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(item => (
                  <tr key={item.program}>
                    <td className="program-cell">{item.program}</td>
                    <td className="number-cell">{item.totalStudents}</td>
                    <td className="number-cell">Rs{item.totalFees.toLocaleString('en-IN')}</td>
                    <td className="number-cell collected">Rs{item.collectedFees.toLocaleString('en-IN')}</td>
                    <td className="number-cell pending">Rs{item.pendingFees.toLocaleString('en-IN')}</td>
                    <td className="number-cell defaulter-cell">{item.defaulters}</td>
                    <td>
                      <div className="progress-cell">
                        <div className="progress-track">
                          <div 
                            className={`progress-fill ${getProgramStatus(item.collectionRate)}`}
                            style={{ width: `${Math.min(item.collectionRate, 100)}%` }}
                          ></div>
                        </div>
                        <span className="progress-value">{item.collectionRate.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${getProgramStatus(item.collectionRate)}`}>
                        {getProgramStatus(item.collectionRate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1">
                <path d="M3 3h18v18H3z"/>
                <path d="M3 7h18M3 11h18M3 15h18M3 19h18"/>
              </svg>
            </div>
            <p className="empty-text">No programs found for the selected filter</p>
            <button 
              onClick={() => setSelectedProgram('')} 
              className="clear-btn"
            >
              Clear Filter
            </button>
          </div>
        )}
      </div>

      <div className="legend-section">
        <div className="legend-header">
          <h3 className="legend-title">Status Indicators</h3>
        </div>
        <div className="legend-content">
          <div className="legend-item">
            <div className="legend-indicator excellent"></div>
            <span className="legend-text">Excellent (≥90%)</span>
          </div>
          <div className="legend-item">
            <div className="legend-indicator good"></div>
            <span className="legend-text">Good (75-89%)</span>
          </div>
          <div className="legend-item">
            <div className="legend-indicator average"></div>
            <span className="legend-text">Average (50-74%)</span>
          </div>
          <div className="legend-item">
            <div className="legend-indicator poor"></div>
            <span className="legend-text">Poor (&lt;50%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassWiseReports;