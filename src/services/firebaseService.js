import { db } from '../firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';

// Students Collection with Manual Student ID Support
export const studentsService = {
  // Generate student ID starting with BSF
  generateStudentId() {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random
    return `BSF-${year}${month}-${random}`; // Format: BSF-YYYYMM-XXXX
  },

  // Check if student ID is available
  async isStudentIdAvailable(studentId) {
    try {
      // Check if exists as document ID
      const docRef = doc(db, 'students', studentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) return false;
      
      // Also check if exists in studentId field (for old records)
      const studentsRef = collection(db, 'students');
      const q = query(studentsRef, where('studentId', '==', studentId));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.empty;
    } catch (error) {
      console.error('Error checking student ID:', error);
      return false;
    }
  },

  // Get all students
  async getAllStudents() {
    try {
      const querySnapshot = await getDocs(collection(db, 'students'));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting students:', error);
      throw error;
    }
  },

  // Get student by ID (works with both document ID and studentId field)
  async getStudentById(identifier) {
    try {
      // Try 1: Direct document access
      try {
        const docRef = doc(db, 'students', identifier);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          return {
            id: docSnap.id,
            ...docSnap.data()
          };
        }
      } catch (error) {
        console.log('Not found by document ID, trying studentId field...');
      }

      // Try 2: Search by studentId field
      const studentsRef = collection(db, 'students');
      const q = query(studentsRef, where('studentId', '==', identifier));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return {
          id: doc.id,
          ...doc.data()
        };
      }

      // Try 3: Search by name or contact
      const allQuery = query(studentsRef);
      const allDocs = await getDocs(allQuery);
      
      const matchedDoc = allDocs.docs.find(doc => {
        const data = doc.data();
        return (
          data.name?.toLowerCase().includes(identifier.toLowerCase()) ||
          data.contact === identifier ||
          data.studentId === identifier
        );
      });

      if (matchedDoc) {
        return {
          id: matchedDoc.id,
          ...matchedDoc.data()
        };
      }

      throw new Error('Student not found');
    } catch (error) {
      console.error('Error getting student:', error);
      throw error;
    }
  },

  // Search students
  async searchStudents(searchTerm) {
    try {
      const studentsRef = collection(db, 'students');
      const q = query(
        studentsRef,
        where('name', '>=', searchTerm),
        where('name', '<=', searchTerm + '\uf8ff'),
        limit(20)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error searching students:', error);
      throw error;
    }
  },

  // Add new student with optional manual student ID
  async addStudent(studentData, manualStudentId = null) {
    try {
      let studentId;
      
      if (manualStudentId && manualStudentId.trim()) {
        // Use manual student ID
        studentId = manualStudentId.trim().toUpperCase();
        
        // Validate format
        if (!/^[A-Z0-9-]{3,}$/.test(studentId)) {
          throw new Error('Student ID must contain only letters, numbers, and hyphens (min 3 characters)');
        }
        
        // Check availability
        const isAvailable = await this.isStudentIdAvailable(studentId);
        if (!isAvailable) {
          throw new Error(`Student ID "${studentId}" is already taken. Please choose another.`);
        }
        
        // Use studentId as document ID
        const docRef = doc(db, 'students', studentId);
        await setDoc(docRef, {
          ...studentData,
          studentId: studentId,
          _docId: studentId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        return studentId;
      } else {
        // Auto-generate student ID starting with BSF
        let attempts = 0;
        do {
          studentId = this.generateStudentId();
          attempts++;
          if (attempts > 10) {
            throw new Error('Unable to generate unique student ID. Please try manual entry.');
          }
        } while (!(await this.isStudentIdAvailable(studentId)));
        
        // Use studentId as document ID
        const docRef = doc(db, 'students', studentId);
        await setDoc(docRef, {
          ...studentData,
          studentId: studentId,
          _docId: studentId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        return studentId;
      }
    } catch (error) {
      console.error('Error adding student:', error);
      throw error;
    }
  },

  // Update student
  async updateStudent(studentId, studentData) {
    try {
      // Find the student first (works with any identifier)
      const student = await this.getStudentById(studentId);
      
      if (!student) {
        throw new Error('Student not found');
      }
      
      const docRef = doc(db, 'students', student.id);
      await updateDoc(docRef, {
        ...studentData,
        updatedAt: serverTimestamp()
      });
      
      return student.id;
    } catch (error) {
      console.error('Error updating student:', error);
      throw error;
    }
  },

  // Delete student
  async deleteStudent(studentId) {
    try {
      // Find the student first
      const student = await this.getStudentById(studentId);
      
      if (!student) {
        throw new Error('Student not found');
      }
      
      await deleteDoc(doc(db, 'students', student.id));
      return student.id;
    } catch (error) {
      console.error('Error deleting student:', error);
      throw error;
    }
  },

  // Migrate existing students to new system
  async migrateExistingStudents() {
    try {
      const studentsRef = collection(db, 'students');
      const snapshot = await getDocs(studentsRef);
      const batch = writeBatch(db);
      
      for (const document of snapshot.docs) {
        const data = document.data();
        const oldDocId = document.id;
        
        // Skip if already migrated
        if (data._docId && data.studentId && data._docId === data.studentId) {
          continue;
        }
        
        // Generate or use existing studentId
        let newStudentId;
        
        if (data.studentId && /^[A-Z0-9-]{3,}$/.test(data.studentId)) {
          newStudentId = data.studentId;
        } else {
          newStudentId = this.generateStudentId(); // Now generates BSF format
        }
        
        // Check if new ID exists
        const newDocRef = doc(db, 'students', newStudentId);
        const newDocSnap = await getDoc(newDocRef);
        
        if (!newDocSnap.exists()) {
          // Create new document with studentId as docId
          batch.set(newDocRef, {
            ...data,
            studentId: newStudentId,
            _docId: newStudentId,
            _oldDocId: oldDocId,
            migratedAt: serverTimestamp()
          });
          
          // Delete old document
          const oldDocRef = doc(db, 'students', oldDocId);
          batch.delete(oldDocRef);
          
          console.log(`Migrated: ${oldDocId} -> ${newStudentId}`);
        }
      }
      
      await batch.commit();
      console.log('Migration completed successfully!');
    } catch (error) {
      console.error('Migration error:', error);
    }
  }
};

// Fee Challans Collection (updated to work with studentId)
export const challansService = {
  // Get challans for a student
  async getStudentChallans(studentIdentifier) {
    try {
      // First get the student to get their document ID
      const student = await studentsService.getStudentById(studentIdentifier);
      
      const q = query(
        collection(db, 'feeChallans'),
        where('studentId', '==', student.id), // Use document ID
        orderBy('issueDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting student challans:', error);
      return [];
    }
  },

  // Get all challans
  async getAllChallans() {
    try {
      const q = query(
        collection(db, 'feeChallans'),
        orderBy('issueDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting all challans:', error);
      return [];
    }
  },

  // Add new challan
  async addChallan(challanData) {
    try {
      const docRef = await addDoc(collection(db, 'feeChallans'), {
        ...challanData,
        createdAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding challan:', error);
      throw error;
    }
  },

  // Update challan
  async updateChallan(challanId, challanData) {
    try {
      const docRef = doc(db, 'feeChallans', challanId);
      await updateDoc(docRef, challanData);
    } catch (error) {
      console.error('Error updating challan:', error);
      throw error;
    }
  },

  // Get defaulters
  async getDefaulters() {
    try {
      const now = new Date();
      const q = query(
        collection(db, 'feeChallans'),
        where('status', '==', 'Unpaid'),
        where('dueDate', '<', Timestamp.fromDate(now))
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting defaulters:', error);
      return [];
    }
  },

  // Get challan by ID
  async getChallanById(challanId) {
    try {
      const docRef = doc(db, 'feeChallans', challanId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting challan:', error);
      return null;
    }
  }
};

// Payments Collection (updated to work with studentId)
export const paymentsService = {
  // Get payments for a student
  async getStudentPayments(studentIdentifier) {
    try {
      // First get the student to get their document ID
      const student = await studentsService.getStudentById(studentIdentifier);
      
      const q = query(
        collection(db, 'payments'),
        where('studentId', '==', student.id), // Use document ID
        orderBy('paymentDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting student payments:', error);
      return [];
    }
  },

  // Get payments for a challan
  async getChallanPayments(challanId) {
    try {
      const q = query(
        collection(db, 'payments'),
        where('challanId', '==', challanId),
        orderBy('paymentDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting challan payments:', error);
      throw error;
    }
  },

  // Add new payment
  async addPayment(paymentData) {
    try {
      const docRef = await addDoc(collection(db, 'payments'), {
        ...paymentData,
        createdAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding payment:', error);
      throw error;
    }
  },

  // Get daily collection
  async getDailyCollection(date) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, 'payments'),
        where('paymentDate', '>=', Timestamp.fromDate(startOfDay)),
        where('paymentDate', '<=', Timestamp.fromDate(endOfDay)),
        orderBy('paymentDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting daily collection:', error);
      throw error;
    }
  },

  // Get monthly collection
  async getMonthlyCollection(year, month) {
    try {
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

      const q = query(
        collection(db, 'payments'),
        where('paymentDate', '>=', Timestamp.fromDate(startOfMonth)),
        where('paymentDate', '<=', Timestamp.fromDate(endOfMonth)),
        orderBy('paymentDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting monthly collection:', error);
      throw error;
    }
  },

  // Get all payments
  async getAllPayments() {
    try {
      const q = query(
        collection(db, 'payments'),
        orderBy('paymentDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting all payments:', error);
      return [];
    }
  }
};

// Expenses Collection
export const expensesService = {
  // Get all expenses
  async getAllExpenses() {
    try {
      const q = query(
        collection(db, 'expenses'),
        orderBy('expenseDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting expenses:', error);
      throw error;
    }
  },

  // Add new expense
  async addExpense(expenseData) {
    try {
      const docRef = await addDoc(collection(db, 'expenses'), {
        ...expenseData,
        createdAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding expense:', error);
      throw error;
    }
  },

  // Update expense
  async updateExpense(expenseId, expenseData) {
    try {
      const docRef = doc(db, 'expenses', expenseId);
      await updateDoc(docRef, expenseData);
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  },

  // Delete expense
  async deleteExpense(expenseId) {
    try {
      await deleteDoc(doc(db, 'expenses', expenseId));
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  }
};

// Utility functions
export const utils = {
  // Calculate total fees for a student
  calculateTotalFees(feeComponents) {
    return (
      (feeComponents.registrationFee || 0) +
      (feeComponents.tuitionFee || 0) +
      (feeComponents.examFee || 0) +
      (feeComponents.universityShare || 0) +
      (feeComponents.others || 0)
    );
  },

  // Generate challan number
  generateChallanNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `CH${timestamp}${random}`;
  },

  // Calculate paid amount for a student
  async calculatePaidAmount(studentIdentifier) {
    try {
      const payments = await paymentsService.getStudentPayments(studentIdentifier);
      return payments.reduce((total, payment) => total + (payment.amount || 0), 0);
    } catch (error) {
      console.error('Error calculating paid amount:', error);
      return 0;
    }
  }
};