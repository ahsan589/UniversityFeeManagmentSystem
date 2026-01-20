import React, { useState, useEffect } from 'react';
import { expensesService } from '../../services/firebaseService';
import './Expenses.css';

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash'
  });
  const [error, setError] = useState('');
  const [editingExpense, setEditingExpense] = useState(null);

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Loading expenses from Firebase...');
      const expensesData = await expensesService.getAllExpenses();
      console.log('Loaded expenses:', expensesData);
      
      // Sort expenses by date (newest first)
      const sortedExpenses = expensesData.sort((a, b) => {
        const dateA = getDateFromFirebase(a.expenseDate || a.date);
        const dateB = getDateFromFirebase(b.expenseDate || b.date);
        return dateB - dateA;
      });
      
      setExpenses(sortedExpenses);
    } catch (error) {
      console.error('Error loading expenses:', error);
      setError(`Failed to load expenses: ${error.message}`);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  const getDateFromFirebase = (dateField) => {
    if (!dateField) return new Date();
    if (dateField.toDate) {
      return dateField.toDate();
    } else if (typeof dateField === 'string') {
      return new Date(dateField);
    } else {
      return new Date(dateField);
    }
  };

  const formatDate = (dateField) => {
    try {
      const date = getDateFromFirebase(dateField);
      return date.toLocaleDateString('en-GB');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');

      const expenseData = {
        description: formData.description.trim(),
        category: formData.category,
        amount: parseFloat(formData.amount),
        expenseDate: new Date(formData.date),
        paymentMethod: formData.paymentMethod,
        createdAt: new Date()
      };

      console.log('Submitting expense:', expenseData);

      if (editingExpense) {
        // Update existing expense
        await expensesService.updateExpense(editingExpense.id, expenseData);
        console.log('Expense updated successfully');
      } else {
        // Add new expense
        await expensesService.addExpense(expenseData);
        console.log('Expense added successfully');
      }

      // Reload expenses
      await loadExpenses();
      
      // Reset form
      setFormData({
        description: '',
        amount: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'Cash'
      });
      setEditingExpense(null);
      setShowForm(false);
      
    } catch (error) {
      console.error('Error saving expense:', error);
      setError(`Failed to save expense: ${error.message}`);
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category,
      date: formatDateForInput(expense.expenseDate || expense.date),
      paymentMethod: expense.paymentMethod || 'Cash'
    });
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (expenseId) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        setError('');
        await expensesService.deleteExpense(expenseId);
        console.log('Expense deleted successfully');
        await loadExpenses();
      } catch (error) {
        console.error('Error deleting expense:', error);
        setError(`Failed to delete expense: ${error.message}`);
      }
    }
  };

  const handleCancel = () => {
    setFormData({
      description: '',
      amount: '',
      category: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'Cash'
    });
    setEditingExpense(null);
    setShowForm(false);
    setError('');
  };

  const formatDateForInput = (dateField) => {
    try {
      const date = getDateFromFirebase(dateField);
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error formatting date for input:', error);
      return new Date().toISOString().split('T')[0];
    }
  };

  const formatCurrency = (amount) => {
    return `Rs. ${parseFloat(amount || 0).toLocaleString('en-PK')}`;
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
  
  const currentMonthExpenses = expenses.filter(expense => {
    try {
      const expenseDate = getDateFromFirebase(expense.expenseDate || expense.date);
      const currentDate = new Date();
      return expenseDate.getMonth() === currentDate.getMonth() && 
             expenseDate.getFullYear() === currentDate.getFullYear();
    } catch (error) {
      return false;
    }
  }).reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);

  const todayExpenses = expenses.filter(expense => {
    try {
      const expenseDate = getDateFromFirebase(expense.expenseDate || expense.date);
      const today = new Date();
      return expenseDate.toDateString() === today.toDateString();
    } catch (error) {
      return false;
    }
  }).reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);

  const categories = [
    'Stationery',
    'Utilities', 
    'Maintenance',
    'Transportation',
    'Salaries',
    'Rent',
    'Internet',
    'Phone',
    'Office Supplies',
    'Cleaning',
    'Security',
    'Miscellaneous'
  ];

  const paymentMethods = ['Cash', 'Bank Transfer', 'Cheque', 'Online', 'Card'];

  if (loading) {
    return (
      <div className="expenses">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading expenses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="expenses">
      <div className="expenses-header">
        <div className="header-content">
          <h1>Expenses Management</h1>
          <p>Track and manage college expenses</p>
        </div>
        <button
          className="add-expense-btn"
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) handleCancel();
          }}
        >
          {showForm ? 'Cancel' : '➕ Add Expense'}
        </button>
      </div>

      {error && (
        <div className="error-state">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
          <button onClick={loadExpenses} className="retry-btn">Retry</button>
        </div>
      )}

      <div className="expense-summary">
        <div className="summary-card">
          <div className="card-content">
            <h3>Total Expenses</h3>
            <div className="summary-number">{formatCurrency(totalExpenses)}</div>
            <div className="summary-label">All Time</div>
          </div>
        </div>
        <div className="summary-card primary">
          <div className="card-content">
            <h3>This Month</h3>
            <div className="summary-number">{formatCurrency(currentMonthExpenses)}</div>
            <div className="summary-label">{new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-content">
            <h3>Today</h3>
            <div className="summary-number">{formatCurrency(todayExpenses)}</div>
            <div className="summary-label">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
          </div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="expense-form">
          <div className="form-header">
            <h3>{editingExpense ? 'Edit Expense' : 'Add New Expense'}</h3>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <input
                type="text"
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                placeholder="Enter expense description"
                maxLength="100"
              />
            </div>
            <div className="form-group">
              <label htmlFor="amount">Amount (Rs.) *</label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                min="0"
                step="0.01"
                required
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">Category *</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="">Select Category</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="paymentMethod">Payment Method</label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
              >
                {paymentMethods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="date">Date *</label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="form-group"></div> {/* Spacer */}
          </div>

          <div className="form-actions">
            <button type="button" onClick={handleCancel} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" className="submit-btn">
              {editingExpense ? 'Update Expense' : 'Add Expense'}
            </button>
          </div>
        </form>
      )}

      <div className="expenses-table-container">
        <div className="table-header">
          <h3>Expense History</h3>
          <span className="record-count">{expenses.length} expenses</span>
        </div>
        
        {expenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧾</div>
            <h3>No Expenses Recorded</h3>
            <p>Start by adding your first expense using the "Add Expense" button.</p>
          </div>
        ) : (
          <table className="expenses-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Payment Method</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(expense => (
                <tr key={expense.id} className="table-row">
                  <td className="date-cell">{formatDate(expense.expenseDate || expense.date)}</td>
                  <td className="description-cell">
                    <div className="expense-description">{expense.description}</div>
                  </td>
                  <td className="category-cell">
                    <span className={`category-badge category-${expense.category.toLowerCase().replace(' ', '-')}`}>
                      {expense.category}
                    </span>
                  </td>
                  <td className="method-cell">
                    <span className="method-tag">{expense.paymentMethod || 'Cash'}</span>
                  </td>
                  <td className="amount-cell">{formatCurrency(expense.amount)}</td>
                  <td className="actions-cell">
                    <button
                      onClick={() => handleEdit(expense)}
                      className="edit-btn"
                      title="Edit expense"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="delete-btn"
                      title="Delete expense"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td colSpan="4"><strong>Total</strong></td>
                <td className="total-amount"><strong>{formatCurrency(totalExpenses)}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
};

export default Expenses;