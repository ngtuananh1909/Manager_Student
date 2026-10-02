import React, { useState, useEffect, useRef } from 'react';
import { Problem, TestCase, ProblemSample } from '../../types';
import { useNetwork } from '../../context/NetworkContext';
import { StatementViewer } from '../../components/StatementViewer';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  Clock, 
  Cpu, 
  FolderUp, 
  CheckCircle2, 
  AlertCircle, 
  FileText,
  Upload,
  ExternalLink,
  Download,
  FolderDown,
  Sparkles,
  Layers,
  ArrowUp,
  ArrowDown,
  Eye,
  Copy,
  Check,
  Balance,
  RefreshCw
} from 'lucide-react';

export const ProblemManager: React.FC = () => {
  const { serverUrl } = useNetwork();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProb, setCurrentProb] = useState<Partial<Problem>>({
    code: '',
    title: '',
    difficulty: 'Dễ',
    points: 100,
    timeLimit: 1000,
    memoryLimit: 256,
    category: 'C++11',
    description: '',
    sampleCode: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // C++11 Code\n    return 0;\n}',
    samples: [],
    testCases: []
  });

  // Samples (Test mẫu giáo viên tự nhập)
  const [formSamples, setFormSamples] = useState<ProblemSample[]>([]);

  // Official Test Cases (Testcase chấm chính thức bảo mật)
  const [formTestCases, setFormTestCases] = useState<TestCase[]>([]);
  const modalFolderInputRef = useRef<HTMLInputElement | null>(null);
  const modalFileInputRef = useRef<HTMLInputElement | null>(null);

  // Statement File Management State in Form
  const [pendingPdf, setPendingPdf] = useState<{ name: string; base64: string } | null>(null);
  const [removePdf, setRemovePdf] = useState<boolean>(false);
  const [showPdfPreview, setShowPdfPreview] = useState(true);
  const [statementModal, setStatementModal] = useState<{ title: string; url: string; fileName?: string } | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  // Sample Tests from 'TEST/' folder modal state
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [sampleProblems, setSampleProblems] = useState<any[]>([]);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [importingSample, setImportingSample] = useState(false);
  const [sampleImportMsg, setSampleImportMsg] = useState('');

  // Folder Import State
  const [importModalProb, setImportModalProb] = useState<Problem | null>(null);
  const [importAppendMode, setImportAppendMode] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<{ loading: boolean; errors?: string[]; success?: string }>({ loading: false });
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Dedicated Test Case Manager Modal State
  const [testCaseModalProb, setTestCaseModalProb] = useState<Problem | null>(null);
  const [activeTestCases, setActiveTestCases] = useState<TestCase[]>([]);
  const [savingTestCases, setSavingTestCases] = useState(false);
  const [testCaseSaveSuccess, setTestCaseSaveSuccess] = useState(false);

  // Quick View Test Case Content Modal State
  const [testCaseToView, setTestCaseToView] = useState<TestCase | null>(null);
  const [copiedTestType, setCopiedTestType] = useState<'inp' | 'out' | null>(null);

  // Add Manual Test Case Modal State
  const [manualTestModalOpen, setManualTestModalOpen] = useState(false);
  const [manualTestForm, setManualTestForm] = useState<{
    name: string;
    input: string;
    expectedOutput: string;
    isSample: boolean;
    score: number;
  }>({
    name: '',
    input: '',
    expectedOutput: '',
    isSample: false,
    score: 10
  });

  useEffect(() => {
    fetchProblems();
  }, [serverUrl]);

  const fetchProblems = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/problems?role=host`);
      if (res.ok) setProblems(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePdfSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedExts = ['.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.txt', '.md'];
    const isAllowed = allowedExts.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!isAllowed) {
      alert('Vui lòng chọn file đề bài hợp lệ (PDF, Word .docx/.doc, Ảnh .png/.jpg, Văn bản .txt/.md)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPendingPdf({
        name: file.name,
        base64: reader.result as string
      });
      setRemovePdf(false);
      setShowPdfPreview(true);
    };
    reader.readAsDataURL(file);
  };

  const openSampleModal = async () => {
    setSampleModalOpen(true);
    setSampleLoading(true);
    setSampleImportMsg('');
    try {
      const res = await fetch(`${serverUrl}/api/sample-tests`);
      if (res.ok) {
        const data = await res.json();
        setSampleProblems(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSampleLoading(false);
    }
  };

  const handleImportSample = async (folder?: string, importAll?: boolean) => {
    setImportingSample(true);
    setSampleImportMsg('');
    try {
      const res = await fetch(`${serverUrl}/api/sample-tests/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, importAll })
      });
      const data = await res.json();
      if (res.ok) {
        setSampleImportMsg(data.message || 'Import thành công!');
        fetchProblems();
      } else {
        alert('Lỗi import: ' + (data.error || ''));
      }
    } catch (e: any) {
      alert('Lỗi kết nối máy chủ: ' + e.message);
    } finally {
      setImportingSample(false);
    }
  };

  // Samples handlers
  const handleAddSample = () => {
    setFormSamples(prev => [
      ...prev,
      { id: `sample-${Date.now()}`, name: `Test Mẫu ${String(prev.length + 1).padStart(2, '0')}`, input: '', output: '' }
    ]);
  };

  const handleUpdateSample = (idx: number, field: 'name' | 'input' | 'output', value: string) => {
    setFormSamples(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleDeleteSample = (idx: number) => {
    setFormSamples(prev => prev.filter((_, i) => i !== idx));
  };

  // Official Testcases handlers inside problem modal
  const handleModalTestFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    const testMap = new Map<string, { input?: string; output?: string }>();

    for (const file of files) {
      const pathParts = (file.webkitRelativePath || file.name).split(/[\\/]/);
      let testName = '';
      if (pathParts.length >= 2) {
        testName = pathParts[pathParts.length - 2];
      } else {
        testName = file.name.replace(/\.(inp|out|ans|txt)$/i, '');
      }

      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const content = await file.text();

      if (!testMap.has(testName)) {
        testMap.set(testName, {});
      }
      const entry = testMap.get(testName)!;
      if (ext === 'inp' || ext === 'in') {
        entry.input = content;
      } else if (ext === 'out' || ext === 'ans') {
        entry.output = content;
      } else if (ext === 'txt') {
        if (!entry.input) entry.input = content;
        else entry.output = content;
      }
    }

    const newTests: TestCase[] = [];
    testMap.forEach((val, name) => {
      if (val.input !== undefined || val.output !== undefined) {
        newTests.push({
          id: `tc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name,
          input: val.input || '',
          expectedOutput: val.output || '',
          isSample: false, // STRICTLY OFFICIAL TEST CASE - NOT SAMPLE
          score: 10
        });
      }
    });

    if (newTests.length > 0) {
      const totalPoints = currentProb.points || 100;
      const combined = [...formTestCases, ...newTests];
      const pts = Math.round(totalPoints / combined.length);
      combined.forEach((tc, i) => {
        tc.score = i === combined.length - 1 ? (totalPoints - pts * (combined.length - 1)) : pts;
      });
      setFormTestCases(combined);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProb.code || !currentProb.title) {
      alert('Vui lòng nhập Mã bài và Tiêu đề bài');
      return;
    }

    try {
      const isUpdate = !!currentProb.id;
      const url = isUpdate ? `${serverUrl}/api/problems/${currentProb.id}` : `${serverUrl}/api/problems`;
      const method = isUpdate ? 'PUT' : 'POST';

      const validSamples = formSamples.filter(s => (s.input && s.input.trim()) || (s.output && s.output.trim()));

      const payload = {
        ...currentProb,
        samples: validSamples,
        testCases: formTestCases
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const saved = await res.json();
        const probId = saved.id || currentProb.id;

        // If a new file was selected, upload it
        if (pendingPdf && probId) {
          await fetch(`${serverUrl}/api/problems/${probId}/pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: pendingPdf.name,
              fileData: pendingPdf.base64
            })
          });
        } else if (removePdf && probId) {
          await fetch(`${serverUrl}/api/problems/${probId}/pdf`, { method: 'DELETE' });
        }

        setIsEditing(false);
        setPendingPdf(null);
        setRemovePdf(false);
        fetchProblems();
      } else {
        const data = await res.json();
        alert('Lỗi lưu bài tập: ' + (data.error || ''));
      }
    } catch (e: any) {
      alert('Không thể kết nối máy chủ: ' + e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xoá bài tập này?')) return;
    try {
      const res = await fetch(`${serverUrl}/api/problems/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchProblems();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Folder Import Handler
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !importModalProb) return;

    setImportStatus({ loading: true });

    // Group files by subdirectory (e.g. test01, test02)
    const testMap: Record<string, { inpFile?: string; outFile?: string; input?: string; expectedOutput?: string }> = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPath = file.webkitRelativePath || file.name;
      const parts = relPath.split('/');

      let testFolder = '';
      let fileName = '';

      if (parts.length >= 3) {
        testFolder = parts[1];
        fileName = parts[2];
      } else if (parts.length === 2) {
        testFolder = parts[0];
        fileName = parts[1];
      }

      if (testFolder && fileName) {
        if (!testMap[testFolder]) testMap[testFolder] = {};
        const content = await file.text();

        if (fileName.toLowerCase().endsWith('.inp')) {
          testMap[testFolder].inpFile = fileName;
          testMap[testFolder].input = content;
        } else if (fileName.toLowerCase().endsWith('.out')) {
          testMap[testFolder].outFile = fileName;
          testMap[testFolder].expectedOutput = content;
        }
      }
    }

    const testFolders = Object.keys(testMap).map(folderName => ({
      testName: folderName,
      inpFile: testMap[folderName].inpFile || '',
      outFile: testMap[folderName].outFile || '',
      input: testMap[folderName].input || '',
      expectedOutput: testMap[folderName].expectedOutput || ''
    }));

    if (testFolders.length === 0) {
      setImportStatus({
        loading: false,
        errors: [`Không tìm thấy thư mục test nào theo định dạng {ten}/test0x/{ten}.inp và {ten}.out`]
      });
      return;
    }

    try {
      const res = await fetch(`${serverUrl}/api/problems/${importModalProb.id}/import-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemCode: importModalProb.code,
          tests: testFolders,
          append: importAppendMode
        })
      });

      const data = await res.json();
      if (res.ok) {
        setImportStatus({
          loading: false,
          success: `Đã import thành công ${data.count} test case cho bài [${importModalProb.code}]!`
        });
        fetchProblems();
        if (testCaseModalProb && testCaseModalProb.id === importModalProb.id) {
          setActiveTestCases(data.problem.testCases || []);
        }
      } else {
        setImportStatus({
          loading: false,
          errors: data.details || [data.error || 'Lỗi kiểm tra định dạng thư mục']
        });
      }
    } catch (err: any) {
      setImportStatus({ loading: false, errors: ['Không thể gửi dữ liệu lên máy chủ: ' + err.message] });
    }
  };

  // Open Test Case Manager Modal (Lazy-loads full testcases on demand)
  const openTestCaseManager = async (prob: Problem) => {
    setTestCaseModalProb(prob);
    setTestCaseSaveSuccess(false);
    if (prob.testCases && prob.testCases.length > 0 && prob.testCases[0].input !== undefined) {
      setActiveTestCases([...prob.testCases]);
    } else {
      try {
        const res = await fetch(`${serverUrl}/api/problems/${prob.id}/testcases`);
        if (res.ok) {
          const tcs = await res.json();
          setActiveTestCases(tcs);
        } else {
          setActiveTestCases([...(prob.testCases || [])]);
        }
      } catch (e) {
        setActiveTestCases([...(prob.testCases || [])]);
      }
    }
  };

  // Reorder test case
  const handleMoveTestCase = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeTestCases.length) return;

    const list = [...activeTestCases];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;
    setActiveTestCases(list);
  };

  // Delete individual test case
  const handleDeleteTestCase = (index: number) => {
    if (!confirm(`Bạn có chắc muốn xoá test #${index + 1}?`)) return;
    setActiveTestCases(prev => prev.filter((_, idx) => idx !== index));
  };

  // Update test case property (score, isSample, name)
  const handleUpdateTestCaseField = (index: number, field: keyof TestCase, value: any) => {
    setActiveTestCases(prev => {
      const list = [...prev];
      list[index] = { ...list[index], [field]: value };
      return list;
    });
  };

  // Distribute points evenly
  const handleDistributeScores = () => {
    if (activeTestCases.length === 0) return;
    const totalPoints = testCaseModalProb?.points || 100;
    const each = Math.max(1, Math.round(totalPoints / activeTestCases.length));
    setActiveTestCases(prev => prev.map(tc => ({ ...tc, score: each })));
  };

  // Add manual test case
  const handleAddManualTest = () => {
    if (!manualTestForm.input && !manualTestForm.expectedOutput) {
      alert('Vui lòng nhập input hoặc output');
      return;
    }

    const testNum = activeTestCases.length + 1;
    const newTest: TestCase = {
      id: `tc-manual-${Date.now()}`,
      name: manualTestForm.name.trim() || `test${String(testNum).padStart(2, '0')}`,
      input: manualTestForm.input,
      expectedOutput: manualTestForm.expectedOutput,
      isSample: manualTestForm.isSample,
      score: manualTestForm.score || 10
    };

    setActiveTestCases(prev => [...prev, newTest]);
    setManualTestModalOpen(false);
    setManualTestForm({
      name: '',
      input: '',
      expectedOutput: '',
      isSample: false,
      score: 10
    });
  };

  // Save Test Cases array to server
  const handleSaveTestCases = async () => {
    if (!testCaseModalProb) return;
    setSavingTestCases(true);
    setTestCaseSaveSuccess(false);

    try {
      const res = await fetch(`${serverUrl}/api/problems/${testCaseModalProb.id}/testcases`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCases: activeTestCases })
      });

      if (res.ok) {
        setTestCaseSaveSuccess(true);
        fetchProblems();
        setTimeout(() => setTestCaseSaveSuccess(false), 2500);
      } else {
        const err = await res.json();
        alert(err.error || 'Lỗi lưu bộ test');
      }
    } catch (e: any) {
      alert('Không thể lưu: ' + e.message);
    } finally {
      setSavingTestCases(false);
    }
  };

  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '4px' }}>Ngân Hàng Bài Tập & Test Cases</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Quản lý đề bài, tải đề PDF, thiết lập test case linh hoạt (công khai/ẩn, điểm số, thứ tự) cho các kỳ thi
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-secondary"
            onClick={openSampleModal}
            title="Nhập nhanh các bài tập mẫu từ thư mục TEST có sẵn (LUCKY, PLAN, TEAM...)"
          >
            <FolderDown size={16} /> Import Từ Thư Mục TEST
          </button>

          <button 
            className="btn btn-outline"
            onClick={() => { setLoading(true); fetchProblems(); }}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}
            title="Làm mới danh sách bài tập từ máy chủ"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Làm Mới
          </button>

          <button 
            className="btn btn-primary"
            onClick={() => {
              setCurrentProb({
                code: '',
                title: '',
                difficulty: 'Dễ',
                points: 100,
                timeLimit: 1000,
                memoryLimit: 256,
                category: 'C++11',
                description: '### Đề bài\n\n### Dữ liệu vào (Input)\n\n### Dữ liệu ra (Output)\n',
                sampleCode: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Code C++11\n    return 0;\n}',
                samples: [],
                testCases: []
              });
              setFormSamples([]);
              setFormTestCases([]);
              setPendingPdf(null);
              setRemovePdf(false);
              setShowPdfPreview(true);
              setIsEditing(true);
            }}
          >
            <Plus size={16} /> Thêm Bài Mới
          </button>
        </div>
      </div>

      {/* Problems Master Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary)', marginBottom: '10px' }} />
          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Đang tải danh sách bài tập...</div>
        </div>
      ) : problems.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <FolderUp size={36} color="var(--primary-light)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.1rem', marginBottom: '6px', color: 'var(--text-main)' }}>Chưa Có Bài Tập Nào</h3>
          <p style={{ fontSize: '0.85rem', maxWidth: '440px', margin: '0 auto 18px auto' }}>
            Hệ thống đang ở trạng thái trống. Bạn có thể tự tạo bài mới hoặc nhập nhanh các bài mẫu từ thư mục <strong>TEST/</strong> có sẵn!
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={openSampleModal}>
              <FolderDown size={14} /> Import Từ Thư Mục TEST (LUCKY, PLAN, TEAM)
            </button>
          </div>
        </div>
      ) : (
        <div className="arena-problem-table-container">
          <table className="desktop-data-table">
            <thead>
              <tr>
                <th style={{ width: '48px', textAlign: 'center' }}>#</th>
                <th style={{ width: '110px' }}>Mã Bài</th>
                <th>Tên Đề Bài</th>
                <th style={{ width: '110px' }}>Độ Khó</th>
                <th style={{ width: '160px' }}>Giới Hạn</th>
                <th style={{ width: '130px' }}>Bộ Test</th>
                <th style={{ width: '100px' }}>Điểm</th>
                <th style={{ width: '180px', textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((prob, idx) => (
                <tr key={prob.id} className="data-table-row">
                  <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                  <td>
                    <span className="code-pill">{prob.code}</span>
                  </td>
                  <td>
                    <div className="table-problem-title">
                      <span>{prob.title}</span>
                      {prob.pdfUrl && (
                        <span className="pdf-tag"><FileText size={10} /> PDF</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${
                      prob.difficulty === 'Dễ' ? 'diff-tag-easy' : 
                      prob.difficulty === 'Trung bình' ? 'diff-tag-medium' : 'diff-tag-hard'
                    }`}>
                      {prob.difficulty}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                    {prob.timeLimit}ms • {prob.memoryLimit || 256}MB
                  </td>
                  <td>
                    <button 
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ padding: '2px 8px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => openTestCaseManager(prob)}
                      title="Mở bảng quản lý test case"
                    >
                      <Layers size={11} /> {prob.testCases?.length || 0} tests
                    </button>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.82rem' }}>
                    {prob.points}đ
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
                      {prob.pdfUrl && (
                        <button 
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ padding: '3px 7px', color: 'var(--accent-rose)' }}
                          onClick={() => setStatementModal({ title: prob.title, url: `${serverUrl}${prob.pdfUrl}`, fileName: prob.pdfFileName })}
                          title="Xem đề PDF"
                        >
                          <Eye size={13} />
                        </button>
                      )}
                      <button 
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 7px' }}
                        onClick={async () => {
                          let tcs = prob.testCases || [];
                          if (tcs.length === 0 || tcs[0]?.input === undefined) {
                            try {
                              const res = await fetch(`${serverUrl}/api/problems/${prob.id}/testcases`);
                              if (res.ok) tcs = await res.json();
                            } catch (e) {}
                          }
                          setCurrentProb(prob);
                          setFormSamples(prob.samples && prob.samples.length > 0 ? JSON.parse(JSON.stringify(prob.samples)) : []);
                          setFormTestCases(tcs && tcs.length > 0 ? JSON.parse(JSON.stringify(tcs)) : []);
                          setPendingPdf(null);
                          setRemovePdf(false);
                          setShowPdfPreview(true);
                          setIsEditing(true);
                        }}
                        title="Chỉnh sửa bài toán"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button 
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ padding: '3px 7px' }}
                        onClick={() => handleDelete(prob.id)}
                        title="Xóa bài tập"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Create Problem Modal (5-Section Layout) */}
      {isEditing && (
        <div className="modal-overlay">
          <div className="glass-panel" style={{ width: '100%', maxWidth: '920px', maxHeight: '92vh', overflowY: 'auto', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border-medium)', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={20} color="var(--primary-light)" />
                  {currentProb.id ? 'CHỈNH SỬA BÀI TOÁN' : 'TẠO BÀI TOÁN MỚI'}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                  Đề bài từ File • Test mẫu hiển thị tự nhập • Testcase chính thức bảo mật dùng chấm điểm
                </p>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setIsEditing(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              {/* PHẦN 1: THÔNG TIN BÀI TOÁN */}
              <div style={{ marginBottom: '22px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '14px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      MÃ BÀI (CODE) *
                    </label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="VD: BAI1, SUM, LUCKY" 
                      value={currentProb.code || ''}
                      onChange={(e) => setCurrentProb({ ...currentProb, code: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      TÊN BÀI TOÁN *
                    </label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="VD: Bài 1 - Tổng của hai số" 
                      value={currentProb.title || ''}
                      onChange={(e) => setCurrentProb({ ...currentProb, title: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      ĐỘ KHÓ
                    </label>
                    <select 
                      className="input-field" 
                      value={currentProb.difficulty || 'Dễ'}
                      onChange={(e: any) => setCurrentProb({ ...currentProb, difficulty: e.target.value })}
                    >
                      <option value="Dễ">Dễ</option>
                      <option value="Trung bình">Trung bình</option>
                      <option value="Khó">Khó</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      TỔNG ĐIỂM
                    </label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={currentProb.points || 100}
                      onChange={(e) => setCurrentProb({ ...currentProb, points: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      TIME LIMIT (MS)
                    </label>
                    <input 
                      type="number" 
                      step="100"
                      className="input-field" 
                      value={currentProb.timeLimit || 1000}
                      onChange={(e) => setCurrentProb({ ...currentProb, timeLimit: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      RAM LIMIT (MB)
                    </label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={currentProb.memoryLimit || 256}
                      onChange={(e) => setCurrentProb({ ...currentProb, memoryLimit: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              {/* PHẦN 2: FILE ĐỀ & HIỆN ĐỀ (TRÌNH XEM TÀI LIỆU GIỐNG WORD NỀN TRẮNG) */}
              <div style={{ 
                marginBottom: '24px', 
                background: 'var(--bg-surface-elevated)', 
                border: '1px solid var(--border-medium)', 
                borderRadius: 'var(--radius-md)', 
                padding: '16px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={17} color="var(--accent-rose)" /> 
                      📄 FILE ĐỀ BÀI GỐC & KHUNG HIỆN ĐỀ
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Hỗ trợ Word (.docx), PDF (.pdf), Văn bản (.txt, .md), Ảnh. Nội dung hiển thị như tài liệu Word nền trắng, cuộn đọc toàn bài.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.78rem' }}
                      onClick={() => pdfInputRef.current?.click()}
                    >
                      <Upload size={13} /> {pendingPdf || (currentProb.pdfUrl && !removePdf) ? 'Thay File Đề' : 'Chọn File Đề (.docx / .pdf)'}
                    </button>
                    {(pendingPdf || (currentProb.pdfUrl && !removePdf)) && (
                      <button 
                        type="button" 
                        className="btn btn-danger btn-sm"
                        style={{ fontSize: '0.78rem' }}
                        onClick={() => {
                          setPendingPdf(null);
                          setRemovePdf(true);
                        }}
                      >
                        <Trash2 size={13} /> Gỡ File
                      </button>
                    )}
                  </div>
                </div>

                <input 
                  type="file" 
                  ref={pdfInputRef} 
                  accept=".docx,.pdf,.doc,.png,.jpg,.jpeg,.webp,.bmp,.txt,.md" 
                  style={{ display: 'none' }} 
                  onChange={handlePdfSelected} 
                />

                {(pendingPdf || (currentProb.pdfUrl && !removePdf)) ? (
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      background: 'var(--bg-surface)', 
                      padding: '8px 14px', 
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      marginBottom: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary-light)', fontWeight: 700, fontSize: '0.74rem' }}>
                          {(pendingPdf ? pendingPdf.name : (currentProb.pdfFileName || '')).toUpperCase().endsWith('.DOCX') ? 'WORD .DOCX' : 'DOCUMENT'}
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          {pendingPdf ? pendingPdf.name : (currentProb.pdfFileName || `${currentProb.code}.docx`)}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {pendingPdf ? '• Chờ bấm Lưu để lưu lên máy chủ' : '• Đã lưu trên máy chủ'}
                        </span>
                      </div>

                      <button 
                        type="button" 
                        className="btn btn-outline btn-sm" 
                        style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                        onClick={() => setShowPdfPreview(!showPdfPreview)}
                      >
                        {showPdfPreview ? 'Thu gọn khung xem' : 'Mở rộng khung xem'}
                      </button>
                    </div>

                    {showPdfPreview && (
                      <div style={{ height: '420px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                        <StatementViewer 
                          src={pendingPdf ? pendingPdf.base64 : `${serverUrl}${currentProb.pdfUrl}`} 
                          fileName={pendingPdf ? pendingPdf.name : (currentProb.pdfFileName || `${currentProb.code || 'problem'}.docx`)}
                          title={currentProb.title || 'Đề bài'}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div 
                      style={{ 
                        border: '1.5px dashed var(--border-medium)', 
                        borderRadius: 'var(--radius-sm)', 
                        padding: '24px 16px', 
                        textAlign: 'center', 
                        cursor: 'pointer',
                        background: 'var(--bg-surface)',
                        transition: 'all 0.2s ease',
                        marginBottom: '10px'
                      }}
                      onClick={() => pdfInputRef.current?.click()}
                    >
                      <Upload size={24} style={{ color: 'var(--accent-cyan)', marginBottom: '6px' }} />
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        Nhấp vào đây để chọn File đề bài (.docx, .pdf...)
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        File DOCX sẽ được đọc và hiển thị trực tiếp giống như mở trong Microsoft Word
                      </div>
                    </div>

                    <div style={{ marginTop: '8px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        HOẶC NHẬP TÓM TẮT ĐỀ BÀI DẠNG MARKDOWN:
                      </label>
                      <textarea 
                        className="input-field" 
                        style={{ minHeight: '90px', fontFamily: 'var(--font-mono)', fontSize: '0.84rem', marginTop: '4px' }}
                        placeholder="Nội dung tóm tắt mô tả đề bài nếu không upload file Word/PDF..."
                        value={currentProb.description || ''}
                        onChange={(e) => setCurrentProb({ ...currentProb, description: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* PHẦN 3: TEST MẪU – GIÁO VIÊN TỰ NHẬP */}
              <div style={{ 
                marginBottom: '24px', 
                background: 'var(--bg-surface-elevated)', 
                border: '1px solid var(--border-medium)', 
                borderRadius: 'var(--radius-md)', 
                padding: '16px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FlaskConical size={17} color="var(--accent-amber)" />
                      🧪 TEST MẪU (VÍ DỤ MINH HỌA CHO HỌC SINH)
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Giáo viên tự nhập Input/Output ví dụ. Phần này hiển thị cho học sinh đọc đề & nạp vào chạy thử, KHÔNG dùng để chấm điểm.
                    </div>
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.78rem' }}
                    onClick={handleAddSample}
                  >
                    <Plus size={13} /> Thêm Test Mẫu
                  </button>
                </div>

                {formSamples.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '18px', 
                    border: '1px dashed var(--border-subtle)', 
                    borderRadius: 'var(--radius-sm)', 
                    color: 'var(--text-muted)',
                    fontSize: '0.82rem'
                  }}>
                    Chưa có test mẫu nào. Bấm <strong>"+ Thêm Test Mẫu"</strong> để nhập Input và Output ví dụ cho học sinh.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {formSamples.map((sample, idx) => (
                      <div 
                        key={sample.id || idx} 
                        style={{ 
                          background: 'var(--bg-surface)', 
                          border: '1px solid var(--border-subtle)', 
                          borderRadius: 'var(--radius-sm)', 
                          padding: '12px 14px' 
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', fontWeight: 700, fontSize: '0.74rem' }}>
                              Test mẫu {String(idx + 1).padStart(2, '0')}
                            </span>
                            <input 
                              type="text" 
                              className="input-field" 
                              style={{ width: '180px', padding: '3px 8px', fontSize: '0.78rem', height: 'auto' }}
                              value={sample.name || `Ví dụ ${idx + 1}`}
                              onChange={(e) => handleUpdateSample(idx, 'name', e.target.value)}
                              placeholder="Tên test mẫu"
                            />
                          </div>
                          <button 
                            type="button" 
                            className="btn btn-outline btn-sm" 
                            style={{ padding: '3px 8px', color: 'var(--accent-rose)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                            onClick={() => handleDeleteSample(idx)}
                            title="Xóa test mẫu này"
                          >
                            <Trash2 size={13} /> Xóa
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                              INPUT MẪU
                            </label>
                            <textarea 
                              className="input-field" 
                              rows={3}
                              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', resize: 'vertical' }}
                              placeholder="VD: 3 5"
                              value={sample.input || ''}
                              onChange={(e) => handleUpdateSample(idx, 'input', e.target.value)}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                              OUTPUT MẪU
                            </label>
                            <textarea 
                              className="input-field" 
                              rows={3}
                              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', resize: 'vertical' }}
                              placeholder="VD: 8"
                              value={sample.output || ''}
                              onChange={(e) => handleUpdateSample(idx, 'output', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* PHẦN 4: TESTCASE CHÍNH THỨC DÙNG ĐỂ CHẤM (BẢO MẬT) */}
              <div style={{ 
                marginBottom: '24px', 
                background: 'var(--bg-surface-elevated)', 
                border: '1px solid var(--border-medium)', 
                borderRadius: 'var(--radius-md)', 
                padding: '16px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={17} color="var(--accent-emerald)" />
                      🧪 TESTCASE CHÍNH THỨC (BẢO MẬT DÙNG CHẤM BÀI)
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Dùng <strong>DUY NHẤT để chấm điểm</strong> khi học sinh nộp bài. Hệ thống bảo mật tuyệt đối, không gửi cho học sinh xem.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.78rem' }}
                      onClick={() => modalFolderInputRef.current?.click()}
                    >
                      <FolderUp size={13} /> Chọn Thư Mục Test
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '0.78rem' }}
                      onClick={() => modalFileInputRef.current?.click()}
                    >
                      <Upload size={13} /> Chọn Từng File (.inp/.out)
                    </button>
                    {formTestCases.length > 0 && (
                      <button 
                        type="button" 
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.78rem', color: 'var(--accent-rose)' }}
                        onClick={() => {
                          if (confirm('Bạn có chắc chắn muốn xóa toàn bộ testcase chính thức của bài này?')) {
                            setFormTestCases([]);
                          }
                        }}
                      >
                        <Trash2 size={13} /> Xóa Hết ({formTestCases.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Hidden File/Folder inputs */}
                <input 
                  type="file" 
                  ref={modalFolderInputRef}
                  // @ts-ignore
                  webkitdirectory="" 
                  directory="" 
                  multiple 
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files) handleModalTestFiles(Array.from(e.target.files));
                    e.target.value = '';
                  }}
                />
                <input 
                  type="file" 
                  ref={modalFileInputRef}
                  multiple 
                  accept=".inp,.out,.in,.ans,.txt"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files) handleModalTestFiles(Array.from(e.target.files));
                    e.target.value = '';
                  }}
                />

                {formTestCases.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '20px', 
                    border: '1px dashed var(--border-subtle)', 
                    borderRadius: 'var(--radius-sm)', 
                    color: 'var(--text-muted)',
                    fontSize: '0.82rem'
                  }}>
                    Chưa có testcase chính thức nào. Chọn <strong>"Chọn Thư Mục Test"</strong> để nạp các thư mục test (test01, test02...) chứa file .inp và .out.
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-emerald)' }}>
                        ✓ Đã import {formTestCases.length} testcase chính thức
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Điểm mỗi test: ~{Math.round((currentProb.points || 100) / formTestCases.length)} điểm
                      </span>
                    </div>

                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
                      gap: '6px',
                      maxHeight: '140px',
                      overflowY: 'auto',
                      padding: '8px',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      {formTestCases.map((tc, i) => (
                        <div 
                          key={tc.id || i}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            padding: '4px 8px',
                            background: 'var(--bg-surface-elevated)',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.74rem'
                          }}
                        >
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tc.name || `Test ${i + 1}`}
                          </span>
                          <span style={{ color: 'var(--accent-emerald)', fontWeight: 700, marginLeft: '4px' }}>
                            {tc.score || 0}đ
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* FOOTER ACTIONS */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-medium)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsEditing(false)}>Huỷ</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 24px', fontWeight: 700 }}>
                  <Save size={16} /> Lưu Bài Toán
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEDICATED TEST CASE MANAGER MODAL */}
      {testCaseModalProb && (
        <div className="modal-overlay" onClick={() => setTestCaseModalProb(null)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '880px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: '26px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={22} color="var(--accent-cyan)" /> Quản Lý Bộ Test: [{testCaseModalProb.code}] {testCaseModalProb.title}
                </h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Tổng cộng: <strong>{activeTestCases.length} test cases</strong> • Điểm bài: <strong>{testCaseModalProb.points}đ</strong>
                </div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setTestCaseModalProb(null)}>
                <X size={15} />
              </button>
            </div>

            {/* Success alert */}
            {testCaseSaveSuccess && (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--accent-emerald)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <CheckCircle2 size={16} /> Đã lưu thành công bộ test case vào máy chấm!
              </div>
            )}

            {/* Action Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px', background: 'var(--bg-surface-elevated)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => setManualTestModalOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Plus size={14} /> Thêm Test Thủ Công
                </button>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setImportModalProb(testCaseModalProb);
                    setImportAppendMode(true);
                    setImportStatus({ loading: false });
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  title="Import thêm từ folder mà không làm mất các test đã có"
                >
                  <FolderUp size={14} /> Import Thêm Từ Folder
                </button>
                <button 
                  className="btn btn-outline btn-sm"
                  onClick={handleDistributeScores}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  title="Tự động chia đều điểm cho tất cả các test case"
                >
                  <Sparkles size={14} /> Chia Đều Điểm
                </button>
              </div>

              <button 
                className="btn btn-primary btn-sm"
                style={{ background: 'var(--accent-emerald)', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px' }}
                disabled={savingTestCases}
                onClick={handleSaveTestCases}
              >
                <Save size={14} /> {savingTestCases ? 'Đang lưu...' : 'Lưu Thay Đổi Bộ Test'}
              </button>
            </div>

            {/* Test Case Table */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
              {activeTestCases.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <Layers size={36} style={{ color: 'var(--text-muted)', marginBottom: '8px', opacity: 0.5 }} />
                  <div>Bài tập này hiện chưa có test case nào.</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Bấm <strong>"Thêm Test Thủ Công"</strong> hoặc <strong>"Import Thêm Từ Folder"</strong> để bắt đầu.</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                  <thead style={{ background: 'var(--bg-surface)', position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                      <th style={{ padding: '8px 10px', width: '70px', textAlign: 'center' }}>THỨ TỰ</th>
                      <th style={{ padding: '8px 10px' }}>TÊN TEST</th>
                      <th style={{ padding: '8px 10px' }}>LOẠI TEST</th>
                      <th style={{ padding: '8px 10px', width: '90px' }}>ĐIỂM</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>NỘI DUNG</th>
                      <th style={{ padding: '8px 10px', width: '70px', textAlign: 'center' }}>XÓA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTestCases.map((tc, idx) => (
                      <tr key={tc.id || idx} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="table-row-hover">
                        {/* Order & Move buttons */}
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <button 
                              className="btn btn-outline" 
                              style={{ padding: '2px 4px', fontSize: '0.7rem' }}
                              disabled={idx === 0}
                              onClick={() => handleMoveTestCase(idx, 'up')}
                              title="Di chuyển lên trên"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', minWidth: '16px' }}>
                              #{idx + 1}
                            </span>
                            <button 
                              className="btn btn-outline" 
                              style={{ padding: '2px 4px', fontSize: '0.7rem' }}
                              disabled={idx === activeTestCases.length - 1}
                              onClick={() => handleMoveTestCase(idx, 'down')}
                              title="Di chuyển xuống dưới"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>
                        </td>

                        {/* Name input */}
                        <td style={{ padding: '8px 10px' }}>
                          <input 
                            type="text" 
                            className="input-field" 
                            style={{ padding: '3px 8px', fontSize: '0.8rem', width: '110px' }}
                            value={tc.name || `test${String(idx + 1).padStart(2, '0')}`}
                            onChange={(e) => handleUpdateTestCaseField(idx, 'name', e.target.value)}
                          />
                        </td>

                        {/* Public / Hidden Toggle */}
                        <td style={{ padding: '8px 10px' }}>
                          <button 
                            type="button"
                            className="btn btn-sm"
                            style={{ 
                              fontSize: '0.74rem', 
                              padding: '3px 8px',
                              background: tc.isSample ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.2)',
                              color: tc.isSample ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                              border: `1px solid ${tc.isSample ? 'rgba(16, 185, 129, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`
                            }}
                            onClick={() => handleUpdateTestCaseField(idx, 'isSample', !tc.isSample)}
                            title="Bấm để chuyển đổi giữa Test Công Khai (học sinh xem được đề) và Test Ẩn (chấm điểm bí mật)"
                          >
                            {tc.isSample ? '⭐ Công Khai (Mẫu)' : '🔒 Test Ẩn'}
                          </button>
                        </td>

                        {/* Score input */}
                        <td style={{ padding: '8px 10px' }}>
                          <input 
                            type="number" 
                            className="input-field" 
                            style={{ padding: '3px 8px', fontSize: '0.8rem', width: '70px', textAlign: 'center' }}
                            value={tc.score || 0}
                            onChange={(e) => handleUpdateTestCaseField(idx, 'score', Number(e.target.value))}
                          />
                        </td>

                        {/* Quick View Content Button */}
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <button 
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: '0.74rem', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => setTestCaseToView(tc)}
                          >
                            <Eye size={12} /> Xem .inp / .out
                          </button>
                        </td>

                        {/* Delete button */}
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <button 
                            className="btn btn-danger btn-sm"
                            style={{ padding: '3px 6px' }}
                            onClick={() => handleDeleteTestCase(idx)}
                            title="Xóa test này"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Tổng điểm cấu hình: <strong>{activeTestCases.reduce((sum, tc) => sum + (Number(tc.score) || 0), 0)}đ</strong>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-outline" onClick={() => setTestCaseModalProb(null)}>
                  Đóng
                </button>
                <button 
                  className="btn btn-primary"
                  style={{ background: 'var(--accent-emerald)', border: 'none' }}
                  disabled={savingTestCases}
                  onClick={handleSaveTestCases}
                >
                  <Save size={15} /> {savingTestCases ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK VIEW TEST CASE CONTENT MODAL */}
      {testCaseToView && (
        <div className="modal-overlay" onClick={() => setTestCaseToView(null)} style={{ zIndex: 9999 }}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '640px', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.15rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={18} color="var(--accent-cyan)" /> Nội Dung Test Case: {testCaseToView.name || 'Test'}
              </h3>
              <button className="btn btn-outline btn-sm" onClick={() => setTestCaseToView(null)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>FILE .INP (INPUT)</span>
                  <button 
                    className="btn btn-outline btn-sm" 
                    style={{ fontSize: '0.7rem', padding: '1px 6px' }}
                    onClick={() => {
                      navigator.clipboard.writeText(testCaseToView.input);
                      setCopiedTestType('inp');
                      setTimeout(() => setCopiedTestType(null), 1500);
                    }}
                  >
                    {copiedTestType === 'inp' ? <Check size={11} /> : <Copy size={11} />} {copiedTestType === 'inp' ? 'Đã chép' : 'Sao chép'}
                  </button>
                </div>
                <pre style={{ 
                  background: 'var(--bg-app)', 
                  border: '1px solid var(--border-subtle)', 
                  borderRadius: 'var(--radius-sm)', 
                  padding: '10px', 
                  fontSize: '0.82rem', 
                  color: 'var(--accent-cyan)', 
                  fontFamily: 'var(--font-mono)',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  margin: 0,
                  whiteSpace: 'pre-wrap'
                }}>
                  {testCaseToView.input || '(Trống)'}
                </pre>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>FILE .OUT (OUTPUT KỲ VỌNG)</span>
                  <button 
                    className="btn btn-outline btn-sm" 
                    style={{ fontSize: '0.7rem', padding: '1px 6px' }}
                    onClick={() => {
                      navigator.clipboard.writeText(testCaseToView.expectedOutput);
                      setCopiedTestType('out');
                      setTimeout(() => setCopiedTestType(null), 1500);
                    }}
                  >
                    {copiedTestType === 'out' ? <Check size={11} /> : <Copy size={11} />} {copiedTestType === 'out' ? 'Đã chép' : 'Sao chép'}
                  </button>
                </div>
                <pre style={{ 
                  background: 'var(--bg-app)', 
                  border: '1px solid var(--border-subtle)', 
                  borderRadius: 'var(--radius-sm)', 
                  padding: '10px', 
                  fontSize: '0.82rem', 
                  color: 'var(--accent-emerald)', 
                  fontFamily: 'var(--font-mono)',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  margin: 0,
                  whiteSpace: 'pre-wrap'
                }}>
                  {testCaseToView.expectedOutput || '(Trống)'}
                </pre>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setTestCaseToView(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MANUAL TEST CASE MODAL */}
      {manualTestModalOpen && (
        <div className="modal-overlay" onClick={() => setManualTestModalOpen(false)} style={{ zIndex: 9999 }}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '580px', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={20} color="var(--accent-cyan)" /> Thêm Test Case Thủ Công
              </h3>
              <button className="btn btn-outline btn-sm" onClick={() => setManualTestModalOpen(false)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TÊN TEST</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder={`test${String(activeTestCases.length + 1).padStart(2, '0')}`}
                  value={manualTestForm.name}
                  onChange={(e) => setManualTestForm({ ...manualTestForm, name: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ĐIỂM TEST NÀY</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={manualTestForm.score}
                  onChange={(e) => setManualTestForm({ ...manualTestForm, score: Number(e.target.value) })}
                />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>DỮ LIỆU VÀO (INPUT)</label>
              <textarea 
                className="input-field" 
                style={{ minHeight: '90px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                placeholder="Nhập nội dung dữ liệu vào..."
                value={manualTestForm.input}
                onChange={(e) => setManualTestForm({ ...manualTestForm, input: e.target.value })}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>DỮ LIỆU RA KỲ VỌNG (OUTPUT)</label>
              <textarea 
                className="input-field" 
                style={{ minHeight: '90px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                placeholder="Nhập nội dung dữ liệu ra mong đợi..."
                value={manualTestForm.expectedOutput}
                onChange={(e) => setManualTestForm({ ...manualTestForm, expectedOutput: e.target.value })}
              />
            </div>

            <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="manualSampleToggle"
                checked={manualTestForm.isSample}
                onChange={(e) => setManualTestForm({ ...manualTestForm, isSample: e.target.checked })}
              />
              <label htmlFor="manualSampleToggle" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                Đặt làm <strong>Test Công Khai (Mẫu)</strong> để học sinh thấy trong đề bài
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-outline" onClick={() => setManualTestModalOpen(false)}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={handleAddManualTest}>
                Thêm Vào Danh Sách
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sample Tests Import Modal from 'TEST/' directory */}
      {sampleModalOpen && (
        <div className="modal-overlay" onClick={() => setSampleModalOpen(false)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '720px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '26px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <FolderDown size={22} color="var(--accent-cyan)" /> Import Bộ Test Từ Thư Mục TEST Có Sẵn
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Quét tự động các bài tập mẫu chuẩn Themis trong thư mục <code>TEST/</code> của máy chủ
                </p>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setSampleModalOpen(false)}>
                <X size={15} />
              </button>
            </div>

            {sampleImportMsg && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '12px 16px', borderRadius: 'var(--radius-md)', color: 'var(--accent-emerald)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <CheckCircle2 size={18} /> {sampleImportMsg}
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', paddingRight: '4px' }}>
              {sampleLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Đang quét thư mục TEST...
                </div>
              ) : sampleProblems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Không tìm thấy bài tập nào trong thư mục TEST!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {sampleProblems.map((sp) => (
                    <div 
                      key={sp.code} 
                      style={{ 
                        background: 'var(--bg-surface-elevated)', 
                        border: '1px solid var(--border-subtle)', 
                        borderRadius: 'var(--radius-md)', 
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--accent-cyan)' }}>
                            {sp.code}
                          </span>
                          <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-cyan)' }}>
                            {sp.testCount} test cases
                          </span>
                          {sp.hasPdf && (
                            <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
                              <FileText size={11} /> Có đề PDF
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Thư mục: <code>TEST/{sp.folder}</code> (test01..test{sp.testCount < 10 ? '0' + sp.testCount : sp.testCount})
                        </div>
                        {sp.sampleInput && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Input mẫu #1: <code>{sp.sampleInput.trim().replace(/\n/g, ' ')}</code>
                          </div>
                        )}
                      </div>

                      <button 
                        className="btn btn-secondary btn-sm"
                        disabled={importingSample}
                        onClick={() => handleImportSample(sp.folder)}
                      >
                        <FolderUp size={13} /> Nhập Bài Này
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Các bài được nhập sẽ tự động hỗ trợ cả <code>freopen("{'{code}'}.inp")</code> lẫn <code>cin/cout</code>.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setSampleModalOpen(false)}>
                  Đóng
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  disabled={importingSample || sampleProblems.length === 0}
                  onClick={() => handleImportSample(undefined, true)}
                >
                  <FolderDown size={15} /> {importingSample ? 'Đang Import...' : 'Import Tất Cả (LUCKY, PLAN, TEAM)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Testcases Folder Modal */}
      {importModalProb && (
        <div className="modal-overlay" onClick={() => setImportModalProb(null)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '640px', padding: '26px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>
                  {importAppendMode ? 'Import Bổ Sung' : 'Import'} Test Case Cho Bài [{importModalProb.code}]
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {importAppendMode 
                    ? 'Nối tiếp vào danh sách test hiện có (không ghi đè mất test cũ)' 
                    : `Chuẩn: ${importModalProb.code.toLowerCase()}/test0x/${importModalProb.code.toLowerCase()}.inp và .out`}
                </p>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setImportModalProb(null)}>
                <X size={15} />
              </button>
            </div>

            {/* Folder Dropzone */}
            <div 
              style={{ 
                border: '2px dashed var(--border-medium)', 
                borderRadius: 'var(--radius-md)', 
                padding: '36px 20px', 
                textAlign: 'center', 
                background: 'var(--bg-surface-elevated)', 
                cursor: 'pointer',
                marginBottom: '18px'
              }}
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderUp size={42} style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }} />
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>
                Nhấp Vào Đây Để Chọn Thư Mục Chứa Test Cases
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto' }}>
                Chọn thư mục gốc <strong>{importModalProb.code.toLowerCase()}</strong> chứa các thư mục con <code>test01</code>, <code>test02</code>...
              </p>
              <input
                type="file"
                ref={folderInputRef}
                style={{ display: 'none' }}
                // @ts-ignore
                webkitdirectory=""
                directory=""
                multiple
                onChange={handleFolderUpload}
              />
            </div>

            {/* Status Feedback */}
            {importStatus.loading && (
              <div style={{ textAlign: 'center', padding: '14px', color: 'var(--accent-cyan)' }}>
                Đang quét thư mục và kiểm tra tính hợp lệ của các file test...
              </div>
            )}

            {importStatus.success && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--accent-emerald)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> {importStatus.success}
              </div>
            )}

            {importStatus.errors && importStatus.errors.length > 0 && (
              <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '14px', borderRadius: 'var(--radius-md)', color: 'var(--accent-rose)', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={15} /> Phát hiện lỗi cấu trúc thư mục ({importStatus.errors.length}):
                </div>
                <ul style={{ paddingLeft: '20px', lineHeight: 1.5 }}>
                  {importStatus.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick In-App Problem Statement Viewer Modal */}
      {statementModal && (
        <div className="modal-overlay" onClick={() => setStatementModal(null)}>
          <div 
            className="glass-panel" 
            style={{ width: '95%', maxWidth: '980px', height: '88vh', display: 'flex', flexDirection: 'column', padding: '20px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="var(--accent-rose)" />
                <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Xem Đề Bài: {statementModal.title}</h3>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <a 
                  href={statementModal.url}
                  download={statementModal.fileName || 'de_bai'}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                >
                  <Download size={13} /> Tải Về Máy
                </a>
                <button className="btn btn-outline btn-sm" onClick={() => setStatementModal(null)}>
                  <X size={15} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
              <StatementViewer 
                src={statementModal.url}
                fileName={statementModal.fileName}
                title={statementModal.title}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
