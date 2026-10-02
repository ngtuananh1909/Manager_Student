import React, { useState, useEffect, useRef } from 'react';
import { Contest, Problem, ClassGroup, LeaderboardEntry, TestCase, User } from '../../types';
import { useNetwork } from '../../context/NetworkContext';
import { StatementViewer } from '../../components/StatementViewer';
import { 
  Trophy, 
  Plus, 
  Wifi, 
  Globe, 
  Clock, 
  Play, 
  StopCircle, 
  Edit3, 
  Trash2, 
  X, 
  Check, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  Layers, 
  ShieldAlert, 
  School,
  Lock,
  Calendar,
  Timer,
  Eye,
  FileText,
  Search,
  Upload,
  Download,
  ExternalLink,
  FolderDown,
  Sparkles,
  RefreshCw,
  FolderUp,
  FileCheck,
  ChevronDown,
  ChevronRight,
  Printer,
  FileSpreadsheet,
  Save
} from 'lucide-react';

export const ContestManager: React.FC = () => {
  const { serverUrl, socket } = useNetwork();
  const [contests, setContests] = useState<Contest[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [studentScopeSearch, setStudentScopeSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Filter
  const [filterMode, setFilterMode] = useState<'all' | 'running' | 'upcoming' | 'ended' | 'offline' | 'online'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Create / Edit Contest
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContestId, setEditingContestId] = useState<string | null>(null);
  const [formContest, setFormContest] = useState<Partial<Contest>>({
    title: '',
    description: '',
    mode: 'offline', // Default to Offline LAN
    scopeType: 'ALL',
    targetGrades: [],
    targetClasses: [],
    targetStudents: [],
    classIds: [],
    problemIds: [],
    durationMinutes: 45,
    startTime: new Date().toISOString().slice(0, 16),
    endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
    status: 'running',
    gradingMode: 'direct',
    freezeScoreboardMinutes: 15,
    pinCode: '',
    requireFreopen: false,
    ipWhitelist: '',
    antiCheat: {
      preventTabSwitch: true,
      maxTabViolations: 3,
      preventCopyPaste: true
    }
  });

  // Contest-Level PDF Attachment State
  const [pendingContestPdf, setPendingContestPdf] = useState<{ name: string; base64: string } | null>(null);
  const [removeContestPdf, setRemoveContestPdf] = useState<boolean>(false);
  const [showContestPdfPreview, setShowContestPdfPreview] = useState<boolean>(false);
  const contestPdfInputRef = useRef<HTMLInputElement | null>(null);

  // Folder-based Test Cases Import State
  const [importedFolderProblems, setImportedFolderProblems] = useState<{
    code: string;
    title: string;
    points?: number;
    timeLimit?: number; // seconds
    memoryLimit?: number; // MB
    testCases: { name: string; input: string; expectedOutput: string; points: number }[];
    status: 'valid' | 'invalid';
    error?: string;
  }[]>([]);
  const [folderErrors, setFolderErrors] = useState<string[]>([]);
  const [folderSuccessMsg, setFolderSuccessMsg] = useState<string | null>(null);
  const [expandedProblemCodes, setExpandedProblemCodes] = useState<Set<string>>(new Set());
  const [isReadingFolder, setIsReadingFolder] = useState<boolean>(false);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Selector tab for adding problems inside Contest Modal
  const [problemPickerTab, setProblemPickerTab] = useState<'selected' | 'create_direct' | 'existing'>('selected');
  const [problemSearchQuery, setProblemSearchQuery] = useState('');

  // Direct Problem Creation State (Tạo bài tập & nạp test case ngay trong kỳ thi)
  const [directProb, setDirectProb] = useState<{
    code: string;
    title: string;
    difficulty: 'Dễ' | 'Trung bình' | 'Khó';
    points: number;
    timeLimit: number;
    memoryLimit: number;
    description: string;
  }>({
    code: '',
    title: '',
    difficulty: 'Trung bình',
    points: 100,
    timeLimit: 1000,
    memoryLimit: 256,
    description: '### Đề bài\n\n### Dữ liệu vào (Input)\n- Nhập từ bàn phím hoặc file\n\n### Dữ liệu ra (Output)\n- In ra màn hình hoặc file\n'
  });
  const [directProbPdf, setDirectProbPdf] = useState<{ name: string; base64: string } | null>(null);
  const directProbPdfRef = useRef<HTMLInputElement | null>(null);
  const [directTestCases, setDirectTestCases] = useState<TestCase[]>([]);
  const [isAddingTestCase, setIsAddingTestCase] = useState(false);
  const [newTcForm, setNewTcForm] = useState<{
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
    score: 25
  });
  const [savingDirectProb, setSavingDirectProb] = useState(false);

  // Dedicated Test Case Manager Modal for any problem
  const [tcModalProblem, setTcModalProblem] = useState<Problem | null>(null);
  const [tcList, setTcList] = useState<TestCase[]>([]);
  const [savingTcList, setSavingTcList] = useState(false);
  const [tcSaveSuccess, setTcSaveSuccess] = useState(false);
  const [isAddingTcToModal, setIsAddingTcToModal] = useState(false);
  const [modalNewTc, setModalNewTc] = useState<{
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
    score: 20
  });

  // Sample Tests from 'TEST/' folder modal state
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [sampleProblems, setSampleProblems] = useState<any[]>([]);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [importingSample, setImportingSample] = useState(false);
  const [sampleImportMsg, setSampleImportMsg] = useState('');

  // In-App PDF Fullscreen / Modal Viewer
  const [pdfViewerModal, setPdfViewerModal] = useState<{ title: string; url: string; fileName?: string } | null>(null);

  // Quick Problem Manager for a Contest directly from Main Cards
  const [quickManageContest, setQuickManageContest] = useState<Contest | null>(null);

  // Modal Contest Leaderboard
  const [leaderboardContest, setLeaderboardContest] = useState<Contest | null>(null);
  const [contestScores, setContestScores] = useState<LeaderboardEntry[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);

  // Modal Official Report (Tạo Bảng Điểm - Chỉ REAL, 4 cột STT, HỌ VÀ TÊN, LỚP, ĐIỂM)
  const [officialReportModal, setOfficialReportModal] = useState<any | null>(null);
  const [loadingOfficialReport, setLoadingOfficialReport] = useState(false);

  useEffect(() => {
    fetchInitialData();

    if (socket) {
      socket.on('contest:created', (newContest: Contest) => {
        setContests(prev => [newContest, ...prev]);
      });

      socket.on('contest:updated', (updated: Contest) => {
        setContests(prev => prev.map(c => c.id === updated.id ? updated : c));
        if (quickManageContest && quickManageContest.id === updated.id) {
          setQuickManageContest(updated);
        }
      });

      socket.on('contest:deleted', (data: { id: string }) => {
        setContests(prev => prev.filter(c => c.id !== data.id));
      });

      socket.on('problems:update', (updatedProb: Problem) => {
        setProblems(prev => {
          const exists = prev.some(p => p.id === updatedProb.id);
          return exists ? prev.map(p => p.id === updatedProb.id ? updatedProb : p) : [...prev, updatedProb];
        });
      });

      return () => {
        socket.off('contest:created');
        socket.off('contest:updated');
        socket.off('contest:deleted');
        socket.off('problems:update');
      };
    }
  }, [serverUrl, socket]);

  const fetchInitialData = async () => {
    try {
      const [resContests, resProblems, resClasses, resUsers] = await Promise.all([
        fetch(`${serverUrl}/api/contests?role=host`),
        fetch(`${serverUrl}/api/problems?role=host`),
        fetch(`${serverUrl}/api/classes`),
        fetch(`${serverUrl}/api/users`)
      ]);

      if (resContests.ok) setContests(await resContests.json());
      if (resProblems.ok) setProblems(await resProblems.json());
      if (resClasses.ok) setClasses(await resClasses.json());
      if (resUsers.ok) setUsers(await resUsers.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Auto-save Contest Draft State
  const [draftStatus, setDraftStatus] = useState<string>('Đã lưu nháp');
  const [hasRestoredDraft, setHasRestoredDraft] = useState<boolean>(false);
  const draftTimerRef = useRef<any>(null);

  // Auto-save contest draft when form fields change (only during Create mode)
  useEffect(() => {
    if (!isModalOpen || editingContestId) return;
    // Don't auto-save completely empty default form
    if (!formContest.title && importedFolderProblems.length === 0 && !pendingContestPdf) return;

    setDraftStatus('⏳ Đang lưu...');
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);

    draftTimerRef.current = setTimeout(() => {
      try {
        const payload = {
          formContest,
          importedFolderProblems,
          pendingContestPdf,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem('schooljudge_contest_draft', JSON.stringify(payload));
        const now = new Date();
        const pad = (n: number) => n < 10 ? '0' + n : n;
        setDraftStatus(`💾 Đã lưu lúc ${pad(now.getHours())}:${pad(now.getMinutes())}`);
      } catch (e) {
        setDraftStatus('⚠ Không thể lưu');
      }
    }, 700);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [formContest, importedFolderProblems, pendingContestPdf, isModalOpen, editingContestId]);

  // Warn on page unload if unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isModalOpen && !editingContestId && (formContest.title || importedFolderProblems.length > 0)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isModalOpen, editingContestId, formContest.title, importedFolderProblems.length]);

  const handleManualSaveDraft = () => {
    try {
      const payload = {
        formContest,
        importedFolderProblems,
        pendingContestPdf,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('schooljudge_contest_draft', JSON.stringify(payload));
      const now = new Date();
      const pad = (n: number) => n < 10 ? '0' + n : n;
      setDraftStatus(`💾 Đã lưu lúc ${pad(now.getHours())}:${pad(now.getMinutes())}`);
      alert(`✓ Đã lưu bản nháp kỳ thi lúc ${pad(now.getHours())}:${pad(now.getMinutes())}! Dữ liệu của bạn được bảo toàn an toàn.`);
    } catch (e) {
      alert('Không thể lưu bản nháp: Bộ nhớ cục bộ bị đầy hoặc bị chặn.');
    }
  };

  const handleClearDraft = () => {
    if (confirm('Bạn có chắc chắn muốn XÓA BẢN NHÁP này? Toàn bộ thông tin kỳ thi và các bài tập chưa tạo sẽ bị xóa.')) {
      localStorage.removeItem('schooljudge_contest_draft');
      setHasRestoredDraft(false);
      handleOpenCreateModal(true);
    }
  };

  const handleCloseModalWithCheck = () => {
    if (!editingContestId && (formContest.title || importedFolderProblems.length > 0)) {
      if (confirm('Bản nháp của bạn đã được tự động lưu. Bạn có chắc muốn đóng cửa sổ? Khi mở lại, hệ thống sẽ khôi phục lại bản nháp này.')) {
        setIsModalOpen(false);
      }
    } else {
      setIsModalOpen(false);
    }
  };

  const handleOpenCreateModal = (forceFresh = false) => {
    const now = new Date();
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    const formatDT = (d: Date) => {
      const pad = (n: number) => n < 10 ? '0' + n : n;
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setEditingContestId(null);

    // Try loading saved draft
    if (!forceFresh) {
      const savedDraft = localStorage.getItem('schooljudge_contest_draft');
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed && (parsed.formContest?.title || (parsed.importedFolderProblems && parsed.importedFolderProblems.length > 0))) {
            setFormContest(parsed.formContest);
            setImportedFolderProblems(parsed.importedFolderProblems || []);
            setPendingContestPdf(parsed.pendingContestPdf || null);
            setRemoveContestPdf(false);
            setShowContestPdfPreview(false);
            setFolderErrors([]);
            setFolderSuccessMsg(null);
            setExpandedProblemCodes(new Set((parsed.importedFolderProblems || []).map((p: any) => p.code)));
            setProblemPickerTab('selected');
            setHasRestoredDraft(true);
            const dTime = parsed.savedAt ? new Date(parsed.savedAt) : new Date();
            const pad = (n: number) => n < 10 ? '0' + n : n;
            setDraftStatus(`Khôi phục (${pad(dTime.getHours())}:${pad(dTime.getMinutes())})`);
            setIsModalOpen(true);
            return;
          }
        } catch (e) {}
      }
    }

    setHasRestoredDraft(false);
    setDraftStatus('Bản nháp mới');
    setFormContest({
      title: '',
      description: '',
      totalScore: 100,
      mode: 'offline',
      scopeType: 'ALL',
      targetGrades: [],
      targetClasses: [],
      targetStudents: [],
      classIds: [],
      problemIds: [],
      durationMinutes: 45,
      startTime: formatDT(now),
      endTime: formatDT(end),
      status: 'running',
      gradingMode: 'direct',
      freezeScoreboardMinutes: 15,
      pinCode: '',
      hideTestDetailsForStudents: true,
      requireFreopen: false,
      ipWhitelist: '',
      antiCheat: {
        preventTabSwitch: true,
        maxTabViolations: 3,
        preventCopyPaste: true
      }
    });
    setPendingContestPdf(null);
    setRemoveContestPdf(false);
    setShowContestPdfPreview(false);
    setImportedFolderProblems([]);
    setFolderErrors([]);
    setFolderSuccessMsg(null);
    setExpandedProblemCodes(new Set());
    setProblemPickerTab('selected');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: Contest) => {
    const formatDT = (iso: string) => {
      try {
        const d = new Date(iso);
        const pad = (n: number) => n < 10 ? '0' + n : n;
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } catch (e) {
        return iso;
      }
    };

    const contestTotal = c.totalScore || 100;
    const derivedScope = c.scopeType || (
      (c.candidateIds && c.candidateIds.length > 0) ? 'STUDENT' :
      (c.targetGrades && c.targetGrades.length > 0) ? 'GRADE' :
      (c.classIds && c.classIds.length > 0) ? 'CLASS' : 'ALL'
    );
    setEditingContestId(c.id);
    setFormContest({
      ...c,
      scopeType: derivedScope,
      targetGrades: c.targetGrades || [],
      targetClasses: c.targetClasses || c.classIds || [],
      targetStudents: c.targetStudents || c.candidateIds || [],
      classIds: c.targetClasses || c.classIds || [],
      candidateIds: c.targetStudents || c.candidateIds || [],
      totalScore: contestTotal,
      startTime: formatDT(c.startTime),
      endTime: formatDT(c.endTime),
      hideTestDetailsForStudents: c.hideTestDetailsForStudents ?? true,
      requireFreopen: c.requireFreopen ?? false,
      ipWhitelist: c.ipWhitelist || ''
    });
    setPendingContestPdf(null);
    setRemoveContestPdf(false);
    setShowContestPdfPreview(false);

    // Map existing problems into importedFolderProblems for table display
    const contestProbs = (c.problemIds || []).map(pId => problems.find(p => p.id === pId || p.code === pId)).filter(Boolean) as Problem[];
    const mappedProblems = contestProbs.map(p => ({
      code: p.code.toLowerCase(),
      title: p.title || p.code,
      points: p.points || Math.round(contestTotal / (contestProbs.length || 1)),
      timeLimit: Math.round(((p.timeLimit || 1000) / 1000) * 10) / 10,
      memoryLimit: p.memoryLimit || 256,
      testCases: (p.testCases || []).map((tc, idx) => ({
        name: tc.name || `test${String(idx + 1).padStart(2, '0')}`,
        input: tc.input || '',
        expectedOutput: tc.expectedOutput || '',
        points: tc.score || Math.round((p.points || 100) / (p.testCases?.length || 1))
      })),
      status: 'valid' as const
    }));
    setImportedFolderProblems(mappedProblems);
    setFolderErrors([]);
    setFolderSuccessMsg(null);
    setExpandedProblemCodes(new Set(mappedProblems.map(p => p.code)));
    setProblemPickerTab('selected');
    setIsModalOpen(true);
  };

  // Contest PDF / Statement Handlers
  const handleContestPdfSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedExts = ['.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.txt', '.md'];
    const isAllowed = allowedExts.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!isAllowed) {
      alert('Vui lòng chọn file đề bài hợp lệ (PDF, Word .docx/.doc, Ảnh .png/.jpg, Văn bản .txt/.md)');
      return;
    }
    try {
      const reader = new FileReader();
      reader.onload = () => {
        setPendingContestPdf({
          name: file.name,
          base64: reader.result as string
        });
        setRemoveContestPdf(false);
        // Giữ giao diện ổn định, không ép mở viewer tự động
        setShowContestPdfPreview(false);
      };
      reader.onerror = () => {
        alert('Không thể đọc file đề bài đã chọn. Vui lòng thử lại với file khác.');
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert('Đã xảy ra lỗi khi đọc file đề: ' + (err?.message || 'Lỗi không xác định'));
    }
  };

  // Universal Test Cases Upload Handler (Supports Entire Folder, Single Testcase Folder, and Loose .inp/.out files)
  const readSafeFileText = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      try {
        if (typeof file.text === 'function') {
          file.text()
            .then(t => resolve(t || ''))
            .catch(() => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ''));
              reader.onerror = () => resolve('');
              reader.readAsText(file, 'utf-8');
            });
        } else {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => resolve('');
          reader.readAsText(file, 'utf-8');
        }
      } catch (e) {
        resolve('');
      }
    });
  };

  const handleTestFilesUpload = async (files: File[]) => {
    if (!files || files.length === 0) {
      return;
    }

    setIsReadingFolder(true);
    setFolderErrors([]);
    setFolderSuccessMsg(null);

    try {
      const errors: string[] = [];
      // problemCode -> testName -> { inpFile?, outFile?, otherFiles: string[] }
      const problemMap = new Map<string, Map<string, { inpFile?: File; outFile?: File; otherFiles: string[] }>>();

      for (const file of files) {
        const normPath = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
        const parts = normPath.split('/').filter(p => p.trim().length > 0);
        if (parts.length === 0) continue;

        const fileName = parts[parts.length - 1];

        // Skip OS / system hidden files
        if (fileName.startsWith('.') || fileName === 'Thumbs.db' || fileName === 'desktop.ini' || fileName === 'ehthumbs.db') {
          continue;
        }

        const lowerName = fileName.toLowerCase();
        let isInput = false;
        let isOutput = false;

        if (lowerName.endsWith('.inp') || lowerName.endsWith('.in')) {
          isInput = true;
        } else if (lowerName.endsWith('.out') || lowerName.endsWith('.ans')) {
          isOutput = true;
        } else if (lowerName.endsWith('.txt')) {
          if (lowerName.includes('input') || lowerName.includes('inp') || lowerName.endsWith('_in.txt') || lowerName.endsWith('.in.txt')) {
            isInput = true;
          } else if (lowerName.includes('output') || lowerName.includes('out') || lowerName.includes('ans') || lowerName.endsWith('_out.txt') || lowerName.endsWith('.out.txt')) {
            isOutput = true;
          }
        }

        let problemCode = '';
        let testName = '';

        if (parts.length >= 4) {
          // e.g. TestCases/bai1/test01/bai1.inp OR Root/dir/bai1/test01/bai1.inp
          problemCode = parts[parts.length - 3].trim().toLowerCase();
          testName = parts[parts.length - 2].trim().toLowerCase();
        } else if (parts.length === 3) {
          // e.g. bai1/test01/bai1.inp
          problemCode = parts[0].trim().toLowerCase();
          testName = parts[1].trim().toLowerCase();
        } else if (parts.length === 2) {
          // e.g. test01/bai1.inp OR bai1/test01.inp
          const firstPart = parts[0].trim().toLowerCase();
          const baseName = fileName.replace(/\.[^/.]+$/, '').trim().toLowerCase();
          const isTestDir = /^(test|tc|case|subtask)?[_\s-]*\d+$/i.test(firstPart);

          if (isTestDir) {
            testName = firstPart;
            problemCode = (baseName && !['input', 'in', 'output', 'out', 'test', 'data', 'ans'].includes(baseName)) ? baseName : 'bai1';
          } else {
            problemCode = firstPart;
            testName = (baseName && !['input', 'in', 'output', 'out', 'ans'].includes(baseName)) ? baseName : 'test01';
          }
        } else {
          // parts.length === 1: loose files directly selected (e.g. bai1.inp, bai1.out or bai1_test01.inp)
          const baseName = fileName.replace(/\.[^/.]+$/, '').trim();
          const matchSplit = baseName.match(/^([a-zA-Z0-9]+)[_\-\.](test[a-zA-Z0-9]*|\d+)$/i);

          if (matchSplit) {
            problemCode = matchSplit[1].toLowerCase();
            testName = matchSplit[2].toLowerCase();
          } else if (/^(test|tc|case|subtask)?[_\s-]*\d+$/i.test(baseName)) {
            problemCode = 'bai1';
            testName = baseName.toLowerCase();
          } else {
            problemCode = baseName.toLowerCase() || 'bai1';
            testName = 'test01';
          }
        }

        if (!problemCode || !testName) continue;

        if (!problemMap.has(problemCode)) {
          problemMap.set(problemCode, new Map());
        }
        const testsMap = problemMap.get(problemCode)!;
        if (!testsMap.has(testName)) {
          testsMap.set(testName, { otherFiles: [] });
        }
        const testEntry = testsMap.get(testName)!;

        if (isInput) {
          testEntry.inpFile = file;
        } else if (isOutput) {
          testEntry.outFile = file;
        } else {
          testEntry.otherFiles.push(fileName);
        }
      }

      if (problemMap.size === 0) {
        setFolderErrors([
          '❌ Không tìm thấy Test Case hợp lệ trong các file/folder đã chọn.',
          'Vui lòng chọn folder cấu trúc: TestCases/[tên_bài]/[test01]/[tên_bài].inp & .out hoặc chọn trực tiếp file .inp và .out.'
        ]);
        return;
      }

      // Read files & pair .inp and .out
      const newlyParsedProblems: {
        code: string;
        title: string;
        testCases: { name: string; input: string; expectedOutput: string; points: number }[];
      }[] = [];

      for (const [probCode, testsMap] of problemMap.entries()) {
        const testNames = Array.from(testsMap.keys()).sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        );

        const validTestCases: { name: string; input: string; expectedOutput: string; points: number }[] = [];

        for (const tName of testNames) {
          const entry = testsMap.get(tName)!;

          if (!entry.inpFile && !entry.outFile) {
            continue;
          }

          if (!entry.inpFile) {
            errors.push(`❌ Bài "${probCode}", Test Case "${tName}": Thiếu file input (.inp tương ứng).`);
          }
          if (!entry.outFile) {
            errors.push(`❌ Bài "${probCode}", Test Case "${tName}": Thiếu file output (.out tương ứng).`);
          }

          if (entry.inpFile && entry.outFile) {
            try {
              const inpText = await readSafeFileText(entry.inpFile);
              const outText = await readSafeFileText(entry.outFile);
              validTestCases.push({
                name: tName,
                input: inpText,
                expectedOutput: outText,
                points: 0
              });
            } catch (readErr: any) {
              errors.push(`❌ Không thể đọc nội dung file của test "${tName}" bài "${probCode}": ${readErr?.message || 'Lỗi đọc file'}`);
            }
          }
        }

        if (validTestCases.length > 0) {
          newlyParsedProblems.push({
            code: probCode,
            title: probCode,
            testCases: validTestCases
          });
        }
      }

      // Check duplicates against existing importedFolderProblems & Merge
      let addedCount = 0;
      let duplicateCount = 0;
      const updatedList = [...importedFolderProblems];
      const newlyExpanded = new Set(expandedProblemCodes);

      for (const newProb of newlyParsedProblems) {
        newlyExpanded.add(newProb.code);
        let existingProb = updatedList.find(p => p.code.toLowerCase() === newProb.code.toLowerCase());

        if (!existingProb) {
          existingProb = {
            code: newProb.code,
            title: newProb.title,
            points: 20,
            timeLimit: 1, // in seconds
            memoryLimit: 256, // in MB
            testCases: [],
            status: 'valid'
          };
          updatedList.push(existingProb);
        }

        for (const newTc of newProb.testCases) {
          const existingTcIdx = existingProb.testCases.findIndex(
            tc => tc.name.toLowerCase() === newTc.name.toLowerCase()
          );

          if (existingTcIdx >= 0) {
            // Duplicate detected -> update content
            existingProb.testCases[existingTcIdx].input = newTc.input;
            existingProb.testCases[existingTcIdx].expectedOutput = newTc.expectedOutput;
            duplicateCount++;
          } else {
            // New test case
            existingProb.testCases.push(newTc);
            addedCount++;
          }
        }

        // Sort tests
        existingProb.testCases.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        // Recalculate 100 points
        if (existingProb.testCases.length > 0) {
          const pts = Math.round(100 / existingProb.testCases.length);
          existingProb.testCases.forEach((tc, idx) => {
            tc.points = idx === existingProb.testCases.length - 1
              ? (100 - pts * (existingProb.testCases.length - 1))
              : pts;
          });
        }
        existingProb.status = 'valid';
      }

      // Auto balance points across all problems if imported fresh
      const totalContest = Number(formContest.totalScore) || 100;
      const probCount = updatedList.length;
      if (probCount > 0) {
        const base = Math.floor(totalContest / probCount);
        const rem = totalContest - (base * probCount);
        updatedList.forEach((p, idx) => {
          p.points = idx === probCount - 1 ? (base + rem) : base;
        });
      }

      setFolderErrors(errors);
      setImportedFolderProblems(updatedList);
      setExpandedProblemCodes(newlyExpanded);

      if (addedCount > 0 && duplicateCount > 0) {
        setFolderSuccessMsg(`✓ Đã thêm ${addedCount} Test Case mới; Cập nhật/bỏ qua ${duplicateCount} Test Case trùng.`);
      } else if (addedCount > 0) {
        setFolderSuccessMsg(`✓ Đã thêm thành công ${addedCount} Test Case mới.`);
      } else if (duplicateCount > 0) {
        setFolderSuccessMsg(`✓ Đã cập nhật ${duplicateCount} Test Case trùng lặp (không tạo bản ghi thừa).`);
      }
    } catch (err: any) {
      setFolderErrors([`Lỗi khi đọc file Test Case: ${err?.message || 'Lỗi không xác định'}`]);
    } finally {
      setIsReadingFolder(false);
      if (folderInputRef.current) folderInputRef.current.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateProblemConfig = (probCode: string, field: 'points' | 'timeLimit' | 'memoryLimit' | 'title', value: any) => {
    setImportedFolderProblems(prev => prev.map(p => {
      if (p.code.toLowerCase() === probCode.toLowerCase()) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const handleDistributePoints = () => {
    const total = Number(formContest.totalScore) || 100;
    const count = importedFolderProblems.length;
    if (count === 0) return;
    const base = Math.floor(total / count);
    const rem = total - (base * count);
    setImportedFolderProblems(prev => prev.map((p, idx) => ({
      ...p,
      points: idx === count - 1 ? (base + rem) : base
    })));
  };

  const handleDeleteTestCase = (problemCode: string, testIdx: number) => {
    setImportedFolderProblems(prev => {
      return prev.map(p => {
        if (p.code !== problemCode) return p;
        const newTests = p.testCases.filter((_, idx) => idx !== testIdx);
        if (newTests.length > 0) {
          const pts = Math.round(100 / newTests.length);
          newTests.forEach((tc, idx) => {
            tc.points = idx === newTests.length - 1 ? (100 - pts * (newTests.length - 1)) : pts;
          });
        }
        return {
          ...p,
          testCases: newTests
        };
      }).filter(p => p.testCases.length > 0);
    });
  };

  const handleDeleteImportedProblem = (problemCode: string) => {
    setImportedFolderProblems(prev => prev.filter(p => p.code !== problemCode));
    setExpandedProblemCodes(prev => {
      const next = new Set(prev);
      next.delete(problemCode);
      return next;
    });
  };

  const handleClearAllImported = () => {
    if (confirm('Bạn có chắc muốn xoá toàn bộ Test Case đã import?')) {
      setImportedFolderProblems([]);
      setFolderErrors([]);
      setFolderSuccessMsg(null);
      setExpandedProblemCodes(new Set());
    }
  };

  const handleSaveContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContest.title || !formContest.title.trim()) {
      alert('Vui lòng nhập tên kỳ thi');
      return;
    }

    const totalProblems = importedFolderProblems.length;
    if (totalProblems === 0) {
      alert('Vui lòng Import Thư mục/File Test Case hoặc thêm ít nhất 1 bài tập cho kỳ thi');
      return;
    }

    // 1. Validate total points matching
    const contestTotal = Number(formContest.totalScore) || 100;
    const currentSum = importedFolderProblems.reduce((s, p) => s + (Number(p.points) || 0), 0);
    if (currentSum !== contestTotal) {
      alert(`❌ Không thể tạo kỳ thi:\nTổng điểm các bài (${currentSum}) chưa bằng tổng điểm kỳ thi (${contestTotal}).\n${currentSum < contestTotal ? `Còn thiếu: ${contestTotal - currentSum} điểm` : `Thừa: ${currentSum - contestTotal} điểm`}.\n\nVui lòng điều chỉnh điểm các bài hoặc bấm "Tự động chia đều điểm"!`);
      return;
    }

    // 2. Validate each problem
    for (const p of importedFolderProblems) {
      if (!p.points || p.points <= 0) {
        alert(`❌ Bài "${p.code}": Điểm của bài phải lớn hơn 0`);
        return;
      }
      if (!p.timeLimit || p.timeLimit <= 0) {
        alert(`❌ Bài "${p.code}": Giới hạn thời gian (Time Limit) phải lớn hơn 0 giây`);
        return;
      }
      if (!p.memoryLimit || p.memoryLimit <= 0) {
        alert(`❌ Bài "${p.code}": Giới hạn bộ nhớ (Memory Limit) phải lớn hơn 0 MB`);
        return;
      }
      if (!p.testCases || p.testCases.length === 0) {
        alert(`❌ Bài "${p.code}": Phải có ít nhất 1 Test Case hợp lệ`);
        return;
      }
    }

    if (folderErrors.length > 0) {
      if (!confirm(`Phát hiện ${folderErrors.length} cảnh báo / lỗi trong thư mục Test Case. Bạn có chắc chắn muốn bỏ qua các test lỗi và tiếp tục tạo kỳ thi?`)) {
        return;
      }
    }

    try {
      const isEdit = !!editingContestId;
      const url = isEdit ? `${serverUrl}/api/contests/${editingContestId}` : `${serverUrl}/api/contests`;
      const method = isEdit ? 'PUT' : 'POST';

      const parseDateSafe = (val: any, fallbackMs: number) => {
        try {
          if (!val) return new Date(fallbackMs).toISOString();
          const d = new Date(val);
          return !isNaN(d.getTime()) ? d.toISOString() : new Date(fallbackMs).toISOString();
        } catch (e) {
          return new Date(fallbackMs).toISOString();
        }
      };

      const payload = {
        ...formContest,
        totalScore: contestTotal,
        importedProblems: importedFolderProblems.filter(p => p.testCases && p.testCases.length > 0).map(p => ({
          code: p.code,
          title: p.title || p.code,
          points: Number(p.points) || Math.round(contestTotal / importedFolderProblems.length),
          timeLimit: Math.round((Number(p.timeLimit) || 1) * 1000), // convert seconds to ms
          memoryLimit: Number(p.memoryLimit) || 256,
          testCases: p.testCases
        })),
        startTime: parseDateSafe(formContest.startTime, Date.now()),
        endTime: parseDateSafe(formContest.endTime, Date.now() + 60 * 60 * 1000)
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const saved = await res.json();
        const contestId = saved.id || editingContestId;

        // Handle Contest PDF upload / remove
        if (pendingContestPdf && contestId) {
          try {
            await fetch(`${serverUrl}/api/contests/${contestId}/pdf`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: pendingContestPdf.name,
                fileData: pendingContestPdf.base64
              })
            });
          } catch (pdfErr) {
            console.warn('Lỗi tải file PDF đính kèm:', pdfErr);
          }
        } else if (removeContestPdf && contestId) {
          try {
            await fetch(`${serverUrl}/api/contests/${contestId}/pdf`, { method: 'DELETE' });
          } catch (e) {}
        }

        localStorage.removeItem('schooljudge_contest_draft');
        setHasRestoredDraft(false);
        setIsModalOpen(false);
        setPendingContestPdf(null);
        setRemoveContestPdf(false);
        setImportedFolderProblems([]);
        setFolderErrors([]);
        setFolderSuccessMsg(null);
        fetchInitialData();
      } else {
        let errorMsg = `Có lỗi xảy ra trên máy chủ (HTTP ${res.status})`;
        try {
          const err = await res.json();
          errorMsg = err.error || err.message || errorMsg;
        } catch (e) {
          const text = await res.text().catch(() => '');
          if (text) errorMsg = text.substring(0, 300);
        }
        alert('Lỗi lưu kỳ thi: ' + errorMsg);
      }
    } catch (e: any) {
      alert('Không thể kết nối máy chủ: ' + e.message);
    }
  };

  const handleDeleteContest = async (id: string, title: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xoá kỳ thi "${title}"?`)) return;
    try {
      const res = await fetch(`${serverUrl}/api/contests/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setContests(prev => prev.filter(c => c.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleStatus = async (c: Contest, newStatus: 'running' | 'ended' | 'upcoming') => {
    try {
      const res = await fetch(`${serverUrl}/api/contests/${c.id}/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        setContests(prev => prev.map(item => item.id === c.id ? updated : item));
      }
    } catch (e: any) {
      alert('Lỗi cập nhật trạng thái kỳ thi: ' + e.message);
    }
  };

  // Direct Problem & Testcase creation logic
  const handleDirectPdfSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setDirectProbPdf({
        name: file.name,
        base64: reader.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAddDirectTestCase = () => {
    if (!newTcForm.input && !newTcForm.expectedOutput) {
      alert('Vui lòng nhập Input hoặc Output mong muốn');
      return;
    }
    const idx = directTestCases.length + 1;
    const testName = newTcForm.name.trim() || `test${String(idx).padStart(2, '0')}`;
    const newTc: TestCase = {
      id: `tc-${Date.now()}-${idx}`,
      name: testName,
      input: newTcForm.input,
      expectedOutput: newTcForm.expectedOutput,
      isSample: newTcForm.isSample,
      score: Number(newTcForm.score) || 10
    };
    setDirectTestCases([...directTestCases, newTc]);
    setNewTcForm({
      name: '',
      input: '',
      expectedOutput: '',
      isSample: false,
      score: 20
    });
    setIsAddingTestCase(false);
  };

  const handleAutoSplitDirectScores = () => {
    if (directTestCases.length === 0) return;
    const each = Math.max(1, Math.round(100 / directTestCases.length));
    setDirectTestCases(directTestCases.map(tc => ({ ...tc, score: each })));
  };

  const handleSaveDirectProblem = async () => {
    if (!directProb.code || !directProb.title) {
      alert('Vui lòng nhập Mã bài (VD: BAI1) và Tên bài tập');
      return;
    }

    setSavingDirectProb(true);
    try {
      const cleanCode = directProb.code.trim().toUpperCase();
      const sampleCode = `#include <iostream>\n#include <cstdio>\nusing namespace std;\n\nint main() {\n    // Đọc ghi file ${cleanCode.toLowerCase()}.inp/.out hoặc bàn phím\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    \n    // Lời giải bài ${cleanCode}\n    \n    return 0;\n}\n`;

      const problemData = {
        code: cleanCode,
        title: directProb.title.trim(),
        difficulty: directProb.difficulty,
        points: directProb.points || 100,
        timeLimit: directProb.timeLimit || 1000,
        memoryLimit: directProb.memoryLimit || 256,
        category: 'C++11',
        description: directProb.description || `### Đề bài ${cleanCode}\n\nXem chi tiết trong file đề bài PDF hoặc trao đổi với giáo viên.\n`,
        sampleCode,
        testCases: directTestCases
      };

      const res = await fetch(`${serverUrl}/api/problems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(problemData)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Lỗi tạo bài tập');
      }

      const createdProb: Problem = await res.json();

      // If PDF attached for this problem, upload it
      if (directProbPdf) {
        await fetch(`${serverUrl}/api/problems/${createdProb.id}/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: directProbPdf.name,
            fileData: directProbPdf.base64
          })
        });
      }

      // Add to formContest problemIds
      const nextProblemIds = Array.from(new Set([...(formContest.problemIds || []), createdProb.id]));
      setFormContest(prev => ({ ...prev, problemIds: nextProblemIds }));

      // Also if quick-managing contest from card
      if (quickManageContest) {
        const qNext = Array.from(new Set([...(quickManageContest.problemIds || []), createdProb.id]));
        await fetch(`${serverUrl}/api/contests/${quickManageContest.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ problemIds: qNext })
        });
      }

      // Reset direct form
      setDirectProb({
        code: '',
        title: '',
        difficulty: 'Trung bình',
        points: 100,
        timeLimit: 1000,
        memoryLimit: 256,
        description: '### Đề bài\n\n### Dữ liệu vào (Input)\n\n### Dữ liệu ra (Output)\n'
      });
      setDirectProbPdf(null);
      setDirectTestCases([]);
      setProblemPickerTab('selected');
      await fetchInitialData();
      alert(`Đã tạo thành công bài tập [${cleanCode}] và thêm vào đề thi!`);
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    } finally {
      setSavingDirectProb(false);
    }
  };

  // Sample tests modal helpers
  const openSampleModal = async () => {
    setSampleModalOpen(true);
    setSampleLoading(true);
    setSampleImportMsg('');
    try {
      const res = await fetch(`${serverUrl}/api/sample-tests`);
      if (res.ok) setSampleProblems(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setSampleLoading(false);
    }
  };

  const handleImportSampleToContest = async (folder?: string, importAll?: boolean) => {
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
        // Refresh problems and auto-select imported problem into contest!
        const resProbs = await fetch(`${serverUrl}/api/problems?role=host`);
        if (resProbs.ok) {
          const allProbs: Problem[] = await resProbs.json();
          setProblems(allProbs);

          // Find newly imported problem IDs by code
          const importedCodes = folder ? [folder.toUpperCase()] : ['LUCKY', 'PLAN', 'TEAM'];
          const matchedIds = allProbs.filter(p => importedCodes.includes(p.code)).map(p => p.id);
          
          setFormContest(prev => ({
            ...prev,
            problemIds: Array.from(new Set([...(prev.problemIds || []), ...matchedIds]))
          }));

          if (quickManageContest) {
            const nextP = Array.from(new Set([...(quickManageContest.problemIds || []), ...matchedIds]));
            await fetch(`${serverUrl}/api/contests/${quickManageContest.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ problemIds: nextP })
            });
          }
        }
      } else {
        alert('Lỗi import: ' + (data.error || ''));
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    } finally {
      setImportingSample(false);
    }
  };

  // Test Case Manager Modal for any problem
  const openTcManager = (prob: Problem) => {
    setTcModalProblem(prob);
    setTcList(prob.testCases ? [...prob.testCases] : []);
    setIsAddingTcToModal(false);
    setTcSaveSuccess(false);
  };

  const handleSaveTcList = async () => {
    if (!tcModalProblem) return;
    setSavingTcList(true);
    try {
      const res = await fetch(`${serverUrl}/api/problems/${tcModalProblem.id}/testcases`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCases: tcList })
      });
      if (res.ok) {
        setTcSaveSuccess(true);
        await fetchInitialData();
        setTimeout(() => setTcSaveSuccess(false), 2000);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Lỗi lưu bộ test');
      }
    } catch (e: any) {
      alert('Lỗi kết nối: ' + e.message);
    } finally {
      setSavingTcList(false);
    }
  };

  const handleAddTcToModal = () => {
    if (!modalNewTc.input && !modalNewTc.expectedOutput) {
      alert('Vui lòng nhập Input hoặc Output mong muốn');
      return;
    }
    const idx = tcList.length + 1;
    const testName = modalNewTc.name.trim() || `test${String(idx).padStart(2, '0')}`;
    const newTc: TestCase = {
      id: `tc-${Date.now()}-${idx}`,
      name: testName,
      input: modalNewTc.input,
      expectedOutput: modalNewTc.expectedOutput,
      isSample: modalNewTc.isSample,
      score: Number(modalNewTc.score) || 10
    };
    setTcList([...tcList, newTc]);
    setModalNewTc({
      name: '',
      input: '',
      expectedOutput: '',
      isSample: false,
      score: 20
    });
    setIsAddingTcToModal(false);
  };

  const handleOpenLeaderboard = async (c: Contest) => {
    setLeaderboardContest(c);
    setLoadingScores(true);
    try {
      const res = await fetch(`${serverUrl}/api/contests/${c.id}/leaderboard`);
      if (res.ok) {
        setContestScores(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingScores(false);
    }
  };

  const handleOpenOfficialReport = async (c: Contest) => {
    setLoadingOfficialReport(true);
    try {
      const res = await fetch(`${serverUrl}/api/contests/${c.id}/official-report`);
      if (res.ok) {
        const data = await res.json();
        setOfficialReportModal(data);
      } else {
        alert('Không thể tạo bảng điểm: Kỳ thi chưa có dữ liệu hợp lệ.');
      }
    } catch (e: any) {
      alert('Lỗi kết nối máy chủ: ' + e.message);
    } finally {
      setLoadingOfficialReport(false);
    }
  };

  // Filtered contests
  const filteredContests = contests.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q)) return false;
    }
    if (filterMode === 'running') return c.status === 'running';
    if (filterMode === 'upcoming') return c.status === 'upcoming';
    if (filterMode === 'ended') return c.status === 'ended';
    if (filterMode === 'offline') return c.mode === 'offline';
    if (filterMode === 'online') return c.mode === 'online';
    return true;
  });

  const runningCount = contests.filter(c => c.status === 'running').length;
  const offlineCount = contests.filter(c => c.mode === 'offline').length;
  const onlineCount = contests.filter(c => c.mode === 'online').length;

  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={contestPdfInputRef} 
        style={{ display: 'none' }} 
        accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.bmp,.txt,.md" 
        onChange={handleContestPdfSelected} 
      />
      <input 
        type="file" 
        ref={directProbPdfRef} 
        style={{ display: 'none' }} 
        accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.bmp,.txt,.md" 
        onChange={handleDirectPdfSelected} 
      />

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trophy size={26} style={{ color: 'var(--accent-amber)' }} />
            <h2 style={{ fontSize: '1.45rem', margin: 0 }}>Quản Lý Kỳ Thi & Kiểm Tra Nội Bộ</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
            Tổ chức đợt thi nội bộ, upload đề thi PDF trực tiếp, tạo bài tập & nạp test case ngay trong kỳ thi.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-outline"
            onClick={() => { setLoading(true); fetchInitialData(); }}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}
            title="Làm mới danh sách kỳ thi từ máy chủ"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Làm Mới
          </button>

          <button 
            className="btn btn-secondary"
            onClick={openSampleModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}
            title="Import bộ đề mẫu có sẵn trong thư mục TEST/"
          >
            <FolderDown size={16} /> Nạp Đề Từ Thư Mục TEST
          </button>

          <button 
            className="btn btn-primary" 
            onClick={() => handleOpenCreateModal(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontWeight: 700 }}
          >
            <Plus size={18} /> Tạo Kỳ Thi Mới
          </button>
        </div>
      </div>

      {/* ── LINEAR SEGMENTED TABS & FILTERS ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div className="linear-tabs">
          <button 
            type="button"
            className={`linear-tab-btn ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            Tất cả ({contests.length})
          </button>
          <button 
            type="button"
            className={`linear-tab-btn ${filterMode === 'running' ? 'active' : ''}`}
            onClick={() => setFilterMode('running')}
          >
            <span className="live-indicator-dot" /> Đang thi ({runningCount})
          </button>
          <button 
            type="button"
            className={`linear-tab-btn ${filterMode === 'upcoming' ? 'active' : ''}`}
            onClick={() => setFilterMode('upcoming')}
          >
            Sắp tới
          </button>
          <button 
            type="button"
            className={`linear-tab-btn ${filterMode === 'ended' ? 'active' : ''}`}
            onClick={() => setFilterMode('ended')}
          >
            Đã kết thúc
          </button>
          <button 
            type="button"
            className={`linear-tab-btn ${filterMode === 'offline' ? 'active' : ''}`}
            onClick={() => setFilterMode('offline')}
          >
            <Wifi size={11} /> LAN ({offlineCount})
          </button>
          <button 
            type="button"
            className={`linear-tab-btn ${filterMode === 'online' ? 'active' : ''}`}
            onClick={() => setFilterMode('online')}
          >
            <Globe size={11} /> Web ({onlineCount})
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '240px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Tìm kỳ thi..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '30px', fontSize: '0.8rem', height: '32px' }}
          />
        </div>
      </div>

      {/* Contests List Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>Đang tải danh sách kỳ thi...</div>
      ) : filteredContests.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <Trophy size={42} style={{ color: 'var(--primary-light)', marginBottom: '14px' }} />
          <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '6px' }}>Chưa Có Kỳ Thi Nào</h3>
          <p style={{ fontSize: '0.85rem', maxWidth: '460px', margin: '0 auto 18px auto' }}>
            Tạo kỳ thi mới để học sinh trong phòng máy bắt đầu làm bài, nộp code và theo dõi bảng xếp hạng trực tiếp.
          </p>
          <button className="btn btn-primary btn-sm" onClick={handleOpenCreateModal}>
            <Plus size={15} /> Tạo Kỳ Thi Đầu Tiên
          </button>
        </div>
      ) : (
        <div className="arena-problem-table-container">
          <table className="desktop-data-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Trạng Thái</th>
                <th>Tên Kỳ Thi</th>
                <th style={{ width: '120px' }}>Chế Độ</th>
                <th style={{ width: '160px' }}>Thời Gian</th>
                <th style={{ width: '150px' }}>Đối Tượng</th>
                <th style={{ width: '150px' }}>Đề Bài</th>
                <th style={{ width: '280px', textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredContests.map(c => {
                const isRunning = c.status === 'running';
                const isUpcoming = c.status === 'upcoming';
                const isEnded = c.status === 'ended';

                return (
                  <tr key={c.id} className="data-table-row">
                    <td>
                      {isRunning && (
                        <span className="badge badge-ac" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span className="live-indicator-dot" /> Đang Thi
                        </span>
                      )}
                      {isUpcoming && <span className="badge badge-tle">Sắp Tới</span>}
                      {isEnded && (
                        <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(129, 140, 248, 0.3)' }}>
                          Đã Kết Thúc
                        </span>
                      )}
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{c.title}</span>
                          {c.pdfUrl && (
                            <button
                              type="button"
                              className="pdf-tag"
                              style={{ cursor: 'pointer', border: 'none' }}
                              onClick={() => setPdfViewerModal({ title: c.title, url: `${serverUrl}${c.pdfUrl}`, fileName: c.pdfFileName })}
                              title="Xem đề thi PDF"
                            >
                              <FileText size={10} /> PDF
                            </button>
                          )}
                        </div>
                        {c.description && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                            {c.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {c.mode === 'offline' ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <Wifi size={11} /> LAN Offline
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <Globe size={11} /> Online
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
                        {c.durationMinutes} phút
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {new Date(c.startTime).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const scope = (c.scopeType || '').toUpperCase();
                          if (scope === 'ALL' || (!scope && (!c.classIds || c.classIds.length === 0) && (!c.candidateIds || c.candidateIds.length === 0))) {
                            return <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>Toàn trường</span>;
                          }
                          if (scope === 'GRADE' || (c.targetGrades && c.targetGrades.length > 0)) {
                            const grades = c.targetGrades && c.targetGrades.length > 0 ? c.targetGrades.join(', ') : 'Tất cả';
                            return <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', fontSize: '0.72rem' }}>Khối {grades}</span>;
                          }
                          if (scope === 'STUDENT' || (c.candidateIds && c.candidateIds.length > 0)) {
                            const count = (c.targetStudents || c.candidateIds || []).length;
                            return <span className="badge" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)', fontSize: '0.72rem' }}>{count} Học sinh</span>;
                          }
                          const targetCls = c.targetClasses || c.classIds || [];
                          const names = classes.filter(cls => targetCls.includes(cls.id) || targetCls.includes(cls.name)).map(cls => cls.name).join(', ');
                          return <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', fontSize: '0.72rem' }}>{names || `${targetCls.length} Lớp`}</span>;
                        })()}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {c.problemIds.slice(0, 3).map(pId => {
                          const prob = problems.find(p => p.id === pId || p.code === pId);
                          return (
                            <span 
                              key={pId}
                              onClick={() => prob && openTcManager(prob)}
                              className="code-pill"
                              style={{ cursor: 'pointer', fontSize: '0.7rem' }}
                              title="Xem/sửa test case"
                            >
                              {prob ? prob.code : pId}
                            </span>
                          );
                        })}
                        {c.problemIds.length > 3 && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                            +{c.problemIds.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
                        {isRunning ? (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleToggleStatus(c, 'ended')}
                            style={{ padding: '3px 8px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Kết thúc kỳ thi ngay"
                          >
                            <StopCircle size={12} /> Dừng
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleToggleStatus(c, 'running')}
                            style={{ padding: '3px 8px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title={isUpcoming ? "Bắt đầu kỳ thi ngay" : "Mở lại kỳ thi"}
                          >
                            <Play size={12} /> {isUpcoming ? 'Bắt Đầu' : 'Mở Lại'}
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setQuickManageContest(c)}
                          style={{ padding: '3px 7px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          title="Quản lý nhanh đề bài & testcase"
                        >
                          <Layers size={12} /> Đề & Test
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleOpenLeaderboard(c)}
                          style={{ padding: '3px 7px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          title="Xem xếp hạng"
                        >
                          <Trophy size={12} style={{ color: 'var(--accent-amber)' }} /> BXH
                        </button>

                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleOpenOfficialReport(c)}
                          style={{ 
                            padding: '3px 7px', 
                            fontSize: '0.74rem', 
                            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                            border: 'none',
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '3px' 
                          }}
                          title="Bảng điểm báo cáo chính thức"
                        >
                          <FileCheck size={12} /> Báo Cáo
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleOpenEditModal(c)}
                          style={{ padding: '3px 6px' }}
                          title="Chỉnh sửa kỳ thi"
                        >
                          <Edit3 size={12} />
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleDeleteContest(c.id, c.title)}
                          style={{ padding: '3px 6px', color: 'var(--accent-rose)' }}
                          title="Xóa kỳ thi"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL: TẠO / CHỈNH SỬA KỲ THI ───────────────────── */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModalWithCheck}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '880px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Trophy size={20} style={{ color: 'var(--accent-amber)' }} />
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>
                  {editingContestId ? 'Chỉnh Sửa Kỳ Thi' : 'Thiết Lập Kỳ Thi / Kiểm Tra Mới'}
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {!editingContestId && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.74rem',
                    background: 'var(--bg-app)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    color: hasRestoredDraft ? 'var(--accent-cyan)' : 'var(--text-muted)'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-emerald)' }}></span>
                    <span>{draftStatus}</span>
                  </div>
                )}
                <button type="button" className="btn btn-outline btn-sm" onClick={handleCloseModalWithCheck}>
                  <X size={15} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveContest} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px', paddingRight: '6px' }}>
              {/* 1. Basic Info */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  TÊN KỲ THI / BÀI KIỂM TRA *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ví dụ: Kiểm tra 1 tiết Tin 10 - Học kỳ 1"
                  value={formContest.title || ''}
                  onChange={e => setFormContest({ ...formContest, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  HƯỚNG DẪN / QUY CHẾ LÀM BÀI
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="Ví dụ: Học sinh tự làm bài, không sử dụng tài liệu, bài nộp chạy trong thời gian quy định..."
                  value={formContest.description || ''}
                  onChange={e => setFormContest({ ...formContest, description: e.target.value })}
                />
              </div>

              {/* 2. CHỌN CHẾ ĐỘ THI (OFFLINE LAN vs ONLINE INTERNET) */}
              <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '10px' }}>
                  LỰA CHỌN CHẾ ĐỘ THI (ONLINE / OFFLINE) *
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {/* Option 1: Offline LAN */}
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: `2px solid ${formContest.mode === 'offline' ? '#10b981' : 'var(--border-subtle)'}`,
                    background: formContest.mode === 'offline' ? 'rgba(16,185,129,0.08)' : 'transparent',
                    cursor: 'pointer'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="radio"
                        name="mode"
                        checked={formContest.mode === 'offline'}
                        onChange={() => setFormContest({ ...formContest, mode: 'offline' })}
                      />
                      <Wifi size={16} style={{ color: '#10b981' }} />
                      <strong style={{ color: formContest.mode === 'offline' ? '#34d399' : 'inherit' }}>
                        Chế độ Offline (Mạng LAN Phòng Máy)
                      </strong>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', paddingLeft: '24px' }}>
                      Chạy nội bộ trong phòng tin học của trường. Máy trạm học sinh tự động dò thấy máy chủ qua UDP Beacon mạng LAN. <strong>Không cần kết nối Internet</strong>, cô lập và bảo mật tuyệt đối.
                    </span>
                  </label>

                  {/* Option 2: Online Internet */}
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: `2px solid ${formContest.mode === 'online' ? '#38bdf8' : 'var(--border-subtle)'}`,
                    background: formContest.mode === 'online' ? 'rgba(56,189,248,0.08)' : 'transparent',
                    cursor: 'pointer'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="radio"
                        name="mode"
                        checked={formContest.mode === 'online'}
                        onChange={() => setFormContest({ ...formContest, mode: 'online' })}
                      />
                      <Globe size={16} style={{ color: '#38bdf8' }} />
                      <strong style={{ color: formContest.mode === 'online' ? '#38bdf8' : 'inherit' }}>
                        Chế độ Online (Trực tuyến qua Internet)
                      </strong>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', paddingLeft: '24px' }}>
                      Dành cho học sinh làm bài từ xa tại nhà qua Web/Internet. Tự động kích hoạt <strong>Chống gian lận (Anti-Cheat)</strong>: cảnh báo khi chuyển tab, chống copy-paste.
                    </span>
                  </label>
                </div>
              </div>

              {/* 3. PHẠM VI ÁP DỤNG ĐỀ THI (Rule 28, 29, 34) */}
              <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <School size={16} /> PHẠM VI ĐỀ THI (ĐỐI TƯỢNG ĐƯỢC THI) *
                  </label>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Quy định học sinh nào sẽ nhìn thấy và được phép vào ca thi này
                  </span>
                </div>

                {/* 4 Scope Radio Options */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
                  {/* 1. Toàn trường */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1.5px solid ${(!formContest.scopeType || formContest.scopeType === 'ALL') ? 'var(--primary)' : 'var(--border-subtle)'}`,
                    background: (!formContest.scopeType || formContest.scopeType === 'ALL') ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="scopeType"
                      checked={!formContest.scopeType || formContest.scopeType === 'ALL'}
                      onChange={() => setFormContest({ ...formContest, scopeType: 'ALL', targetClasses: [], classIds: [], targetStudents: [], candidateIds: [], targetGrades: [] })}
                    />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Toàn trường</span>
                  </label>

                  {/* 2. Theo khối */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1.5px solid ${formContest.scopeType === 'GRADE' ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                    background: formContest.scopeType === 'GRADE' ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="scopeType"
                      checked={formContest.scopeType === 'GRADE'}
                      onChange={() => setFormContest({ ...formContest, scopeType: 'GRADE' })}
                    />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Theo khối</span>
                  </label>

                  {/* 3. Chọn lớp */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1.5px solid ${formContest.scopeType === 'CLASS' ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                    background: formContest.scopeType === 'CLASS' ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="scopeType"
                      checked={formContest.scopeType === 'CLASS'}
                      onChange={() => setFormContest({ ...formContest, scopeType: 'CLASS' })}
                    />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Chọn lớp</span>
                  </label>

                  {/* 4. Chọn học sinh */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1.5px solid ${formContest.scopeType === 'STUDENT' ? 'var(--accent-rose)' : 'var(--border-subtle)'}`,
                    background: formContest.scopeType === 'STUDENT' ? 'rgba(244, 63, 94, 0.1)' : 'transparent',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="scopeType"
                      checked={formContest.scopeType === 'STUDENT'}
                      onChange={() => setFormContest({ ...formContest, scopeType: 'STUDENT' })}
                    />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Chọn học sinh</span>
                  </label>
                </div>

                {/* Contextual Scope Details */}
                {(!formContest.scopeType || formContest.scopeType === 'ALL') && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                    ✓ Mọi học sinh trong toàn trường đều có thể nhìn thấy và làm bài thi này.
                  </div>
                )}

                {formContest.scopeType === 'GRADE' && (
                  <div style={{ padding: '12px', background: 'rgba(168, 85, 247, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-purple)', marginBottom: '8px' }}>
                      CHỌN CÁC KHỐI ĐƯỢC THI:
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {[6, 7, 8, 9, 10, 11, 12].map(g => {
                        const isChecked = (formContest.targetGrades || []).includes(g);
                        return (
                          <label key={g} style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            background: isChecked ? 'var(--accent-purple)' : 'var(--bg-surface)',
                            color: isChecked ? '#fff' : 'var(--text-main)',
                            border: `1px solid ${isChecked ? 'var(--accent-purple)' : 'var(--border-medium)'}`,
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                            fontWeight: 600
                          }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                const current = formContest.targetGrades || [];
                                const next = e.target.checked ? [...current, g] : current.filter(x => x !== g);
                                setFormContest({ ...formContest, targetGrades: next });
                              }}
                            />
                            <span>Khối {g}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                      Học sinh thuộc bất kỳ lớp nào trong các khối trên sẽ được phép tham gia.
                    </div>
                  </div>
                )}

                {formContest.scopeType === 'CLASS' && (
                  <div style={{ padding: '12px', background: 'rgba(6, 182, 212, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                        CHỌN CÁC LỚP ÁP DỤNG ({((formContest.targetClasses || formContest.classIds) || []).length}/{classes.length} lớp):
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                          onClick={() => {
                            const allIds = classes.map(c => c.id);
                            setFormContest({ ...formContest, targetClasses: allIds, classIds: allIds });
                          }}
                        >
                          Chọn tất cả
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                          onClick={() => setFormContest({ ...formContest, targetClasses: [], classIds: [] })}
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxHeight: '160px', overflowY: 'auto' }}>
                      {classes.map(c => {
                        const selected = (formContest.targetClasses || formContest.classIds || []).includes(c.id);
                        return (
                          <label key={c.id} style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: selected ? 'var(--primary)' : 'var(--bg-surface)',
                            color: selected ? '#fff' : 'var(--text-main)',
                            border: `1px solid ${selected ? 'var(--primary)' : 'var(--border-medium)'}`,
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                            fontWeight: 600
                          }}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={e => {
                                const current = formContest.targetClasses || formContest.classIds || [];
                                const next = e.target.checked ? [...current, c.id] : current.filter(x => x !== c.id);
                                setFormContest({ ...formContest, targetClasses: next, classIds: next });
                              }}
                            />
                            <span>{c.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {formContest.scopeType === 'STUDENT' && (
                  <div style={{ padding: '12px', background: 'rgba(244, 63, 94, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-rose)' }}>
                        CHỌN HỌC SINH ĐƯỢC THI ({((formContest.targetStudents || formContest.candidateIds) || []).length} em):
                      </div>
                      <div style={{ position: 'relative', width: '220px' }}>
                        <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          placeholder="Tìm học sinh theo tên, user..."
                          className="input-field"
                          style={{ height: '28px', fontSize: '0.75rem', paddingLeft: '26px' }}
                          value={studentScopeSearch}
                          onChange={e => setStudentScopeSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                      {users.filter(u => u.role !== 'host').filter(u => {
                        if (!studentScopeSearch.trim()) return true;
                        const q = studentScopeSearch.toLowerCase();
                        return (u.fullName || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
                      }).map(u => {
                        const selected = (formContest.targetStudents || formContest.candidateIds || []).includes(u.id);
                        return (
                          <label key={u.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            background: selected ? 'rgba(244, 63, 94, 0.15)' : 'var(--bg-surface)',
                            border: `1px solid ${selected ? 'rgba(244, 63, 94, 0.4)' : 'var(--border-subtle)'}`,
                            cursor: 'pointer',
                            fontSize: '0.78rem'
                          }}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={e => {
                                const current = formContest.targetStudents || formContest.candidateIds || [];
                                const next = e.target.checked ? [...current, u.id] : current.filter(x => x !== u.id);
                                setFormContest({ ...formContest, targetStudents: next, candidateIds: next });
                              }}
                            />
                            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.fullName || u.username}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 4. UPLOAD FILE PDF ĐỀ THI TỔNG HỢP CỦA KỲ THI */}
              <div style={{ 
                background: 'var(--bg-surface-elevated)', 
                border: '1px solid var(--border-medium)', 
                borderRadius: 'var(--radius-md)', 
                padding: '14px 16px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={16} color="var(--accent-rose)" /> FILE ĐỀ THI TỔNG HỢP DẠNG PDF (TOÀN BỘ ĐỀ THI)
                  </label>
                  {formContest.pdfUrl && !removeContestPdf && (
                    <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', fontSize: '0.75rem' }}>
                      Đang có file PDF đề thi
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Tải lên file PDF tổng hợp chứa tất cả câu hỏi của kỳ thi (xuất từ Word/LaTeX). Học sinh có thể xem toàn bộ đề thi trực tiếp trong phòng thi mà không cần in giấy.
                </p>

                {(pendingContestPdf || (formContest.pdfUrl && !removeContestPdf)) ? (
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      background: 'var(--bg-surface)', 
                      padding: '10px 14px', 
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      marginBottom: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={22} color="var(--accent-rose)" />
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                            {pendingContestPdf ? pendingContestPdf.name : (formContest.pdfFileName || `${formContest.title || 'de_thi'}.pdf`)}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {pendingContestPdf ? '(Chờ bấm "Lưu Thay Đổi" để cập nhật)' : '(Đã đính kèm trên máy chủ)'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          type="button" 
                          className="btn btn-outline btn-sm"
                          style={{ fontSize: '0.78rem' }}
                          onClick={() => setShowContestPdfPreview(!showContestPdfPreview)}
                        >
                          {showContestPdfPreview ? 'Ẩn Xem Trước' : 'Xem Trước Đề'}
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.78rem' }}
                          onClick={() => contestPdfInputRef.current?.click()}
                        >
                          <Upload size={13} /> Thay File
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-danger btn-sm"
                          style={{ fontSize: '0.78rem' }}
                          onClick={() => {
                            setPendingContestPdf(null);
                            setRemoveContestPdf(true);
                          }}
                        >
                          <Trash2 size={13} /> Gỡ Bỏ
                        </button>
                      </div>
                    </div>

                    {/* Inline Statement Preview Viewer */}
                    {showContestPdfPreview && (
                      <div style={{ height: '360px', marginBottom: '8px' }}>
                        <StatementViewer 
                          src={pendingContestPdf ? pendingContestPdf.base64 : `${serverUrl}${formContest.pdfUrl}`} 
                          url={pendingContestPdf ? pendingContestPdf.base64 : `${serverUrl}${formContest.pdfUrl}`} 
                          fileName={pendingContestPdf ? pendingContestPdf.name : (formContest.pdfFileName || 'de_thi')}
                          title={formContest.title || 'Đề thi'}
                          serverUrl={serverUrl}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div 
                    style={{ 
                      border: '1.5px dashed var(--border-medium)', 
                      borderRadius: 'var(--radius-sm)', 
                      padding: '16px', 
                      textAlign: 'center', 
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.02)',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => contestPdfInputRef.current?.click()}
                  >
                    <Upload size={24} color="var(--primary-light)" style={{ marginBottom: '6px' }} />
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      Nhấp vào đây để chọn file Đề Thi đính kèm
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Hỗ trợ: PDF (.pdf), Word (.docx, .doc), Ảnh đề bài (.png, .jpg), Văn bản (.txt, .md)
                    </div>
                  </div>
                )}
              </div>

              {/* 4. IMPORT BỘ TEST CASE (FOLDER HOẶC TEST RIÊNG LẺ) */}
              <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                {/* Hidden folder input */}
                <input
                  type="file"
                  ref={folderInputRef}
                  {...({ webkitdirectory: '', directory: '' } as any)}
                  multiple
                  onChange={(e) => handleTestFilesUpload(Array.from(e.target.files || []))}
                  style={{ display: 'none' }}
                />

                {/* Hidden individual files input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".inp,.out,.ans,.txt"
                  multiple
                  onChange={(e) => handleTestFilesUpload(Array.from(e.target.files || []))}
                  style={{ display: 'none' }}
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FolderUp size={18} color="var(--accent-cyan)" /> IMPORT / FETCH TEST CASE *
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Hỗ trợ chọn cả thư mục <code>TestCases/</code> (nhiều bài) hoặc chọn file test riêng lẻ (<code>.inp</code> + <code>.out</code>).
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => folderInputRef.current?.click()}
                      disabled={isReadingFolder}
                      style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none',
                        padding: '7px 14px',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
                      }}
                    >
                      <FolderUp size={15} /> 
                      {isReadingFolder ? 'Đang đọc...' : 'Chọn Cả Thư Mục (Folder)'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isReadingFolder}
                      style={{
                        padding: '7px 14px',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderColor: 'var(--accent-cyan)',
                        color: 'var(--accent-cyan)'
                      }}
                    >
                      <FileCheck size={15} /> 
                      Chọn File Riêng Lẻ (.inp, .out)
                    </button>

                    {importedFolderProblems.length > 0 && (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            if (expandedProblemCodes.size === importedFolderProblems.length) {
                              setExpandedProblemCodes(new Set());
                            } else {
                              setExpandedProblemCodes(new Set(importedFolderProblems.map(p => p.code)));
                            }
                          }}
                          style={{ fontSize: '0.74rem' }}
                        >
                          {expandedProblemCodes.size === importedFolderProblems.length ? 'Thu Gọn Tất Cả' : 'Mở Rộng Tất Cả'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={handleClearAllImported}
                          style={{ fontSize: '0.74rem', color: 'var(--accent-rose)' }}
                          title="Xóa tất cả bộ test đã import"
                        >
                          <Trash2 size={13} /> Xóa tất cả
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Success Alert Banner */}
                {folderSuccessMsg && (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid #10b981',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 14px',
                    marginBottom: '12px',
                    fontSize: '0.82rem',
                    color: '#6ee7b7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} color="#10b981" />
                      <span>{folderSuccessMsg}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFolderSuccessMsg(null)}
                      style={{ background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Validation Errors Alert Box */}
                {folderErrors.length > 0 && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid #ef4444',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 16px',
                    marginBottom: '14px',
                    fontSize: '0.82rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontWeight: 700 }}>
                        <AlertTriangle size={16} /> Thông báo kiểm tra Test Case ({folderErrors.length}):
                      </div>
                      <button
                        type="button"
                        onClick={() => setFolderErrors([])}
                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#fca5a5', lineHeight: '1.6' }}>
                      {folderErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* TEST CASE ĐÃ FETCH / IMPORT BANNER & TABLE */}
                {importedFolderProblems.length > 0 ? (
                  <div>
                    {/* Summary Overview Card */}
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 14px',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FileCheck size={16} color="var(--accent-emerald)" /> TEST CASE ĐÃ FETCH ({importedFolderProblems.length} BÀI)
                        </div>
                        <div style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: 'var(--accent-emerald)',
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          padding: '3px 10px',
                          borderRadius: '20px'
                        }}>
                          Tổng cộng: {importedFolderProblems.reduce((sum, p) => sum + (p.testCases?.length || 0), 0)} Test Case
                        </div>
                      </div>

                      {/* Problem Quick Badges */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {importedFolderProblems.map(p => (
                          <div key={p.code} style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                            borderRadius: '6px',
                            fontSize: '0.78rem'
                          }}>
                            <Check size={13} color="var(--accent-emerald)" />
                            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{p.code}</strong>
                            <span style={{ color: 'var(--text-secondary)' }}>{(p.testCases || []).length} Test Case</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Score Validation Banner */}
                    <div style={{ marginBottom: '12px' }}>
                      {(() => {
                        const sumPoints = importedFolderProblems.reduce((s, p) => s + (Number(p.points) || 0), 0);
                        const contestTotal = Number(formContest.totalScore) || 100;
                        const isMatch = sumPoints === contestTotal;

                        return (
                          <div style={{
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${isMatch ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                            background: isMatch ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '8px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isMatch ? (
                                <CheckCircle2 size={18} color="var(--accent-emerald)" />
                              ) : (
                                <AlertTriangle size={18} color="var(--accent-rose)" />
                              )}
                              <div>
                                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: isMatch ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                                  {isMatch ? '✓ Tổng điểm các bài hợp lệ' : '⚠ Tổng điểm các bài chưa khớp với Tổng điểm kỳ thi'}
                                </div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  Tổng điểm kỳ thi: <strong>{contestTotal} điểm</strong> • Tổng điểm các bài: <strong>{sumPoints} điểm</strong>
                                  {!isMatch && (
                                    <span style={{ color: 'var(--accent-rose)', marginLeft: '6px', fontWeight: 700 }}>
                                      ({sumPoints < contestTotal ? `Còn thiếu: ${contestTotal - sumPoints} điểm` : `Thừa: ${sumPoints - contestTotal} điểm`})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={handleDistributePoints}
                              style={{
                                background: isMatch ? 'var(--bg-surface-elevated)' : 'var(--primary)',
                                color: '#fff',
                                fontSize: '0.78rem',
                                padding: '5px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                border: '1px solid var(--border-subtle)'
                              }}
                            >
                              <Sparkles size={14} /> ⚡ Tự động chia đều điểm
                            </button>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Table View */}
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                            <th style={{ padding: '10px 14px', width: '28%' }}>Bài / Tên bài</th>
                            <th style={{ padding: '10px 10px', width: '16%' }}>Điểm bài</th>
                            <th style={{ padding: '10px 10px', width: '16%' }}>Time Limit (giây)</th>
                            <th style={{ padding: '10px 10px', width: '16%' }}>RAM (MB)</th>
                            <th style={{ padding: '10px 10px', width: '12%' }}>Số Test Case</th>
                            <th style={{ padding: '10px 14px', width: '12%', textAlign: 'right' }}>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importedFolderProblems.map((prob) => {
                            const isExpanded = expandedProblemCodes.has(prob.code);
                            const testCount = (prob.testCases || []).length;

                            return (
                              <React.Fragment key={prob.code}>
                                <tr 
                                  style={{ 
                                    borderBottom: '1px solid var(--border-subtle)',
                                    background: isExpanded ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                                    transition: 'background 0.15s ease'
                                  }}
                                >
                                  {/* Problem Code & Title */}
                                  <td style={{ padding: '10px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setExpandedProblemCodes(prev => {
                                            const next = new Set(prev);
                                            next.has(prob.code) ? next.delete(prob.code) : next.add(prob.code);
                                            return next;
                                          });
                                        }}
                                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px 0 0', display: 'flex', alignItems: 'center' }}
                                        title={isExpanded ? 'Thu gọn test case' : 'Xem các test case'}
                                      >
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                      </button>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 800, fontSize: '0.9rem' }}>
                                          {prob.code}
                                        </div>
                                        <input
                                          type="text"
                                          className="input-field"
                                          placeholder="Tên bài toán"
                                          value={prob.title || ''}
                                          onChange={(e) => updateProblemConfig(prob.code, 'title', e.target.value)}
                                          style={{ fontSize: '0.78rem', padding: '3px 6px', height: '26px', marginTop: '3px', width: '100%' }}
                                        />
                                      </div>
                                    </div>
                                  </td>

                                  {/* Points */}
                                  <td style={{ padding: '10px 10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <input
                                        type="number"
                                        min={1}
                                        max={1000}
                                        className="input-field"
                                        value={prob.points ?? ''}
                                        onChange={(e) => updateProblemConfig(prob.code, 'points', Number(e.target.value))}
                                        style={{ width: '70px', fontWeight: 700, color: 'var(--accent-emerald)', padding: '4px 6px', fontSize: '0.85rem' }}
                                      />
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>đ</span>
                                    </div>
                                  </td>

                                  {/* Time Limit */}
                                  <td style={{ padding: '10px 10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <input
                                        type="number"
                                        step="0.1"
                                        min={0.1}
                                        max={30}
                                        className="input-field"
                                        value={prob.timeLimit ?? 1}
                                        onChange={(e) => updateProblemConfig(prob.code, 'timeLimit', Number(e.target.value))}
                                        style={{ width: '65px', fontFamily: 'var(--font-mono)', padding: '4px 6px', fontSize: '0.85rem' }}
                                      />
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>s</span>
                                    </div>
                                  </td>

                                  {/* Memory Limit */}
                                  <td style={{ padding: '10px 10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <input
                                        type="number"
                                        step={32}
                                        min={16}
                                        max={2048}
                                        className="input-field"
                                        value={prob.memoryLimit ?? 256}
                                        onChange={(e) => updateProblemConfig(prob.code, 'memoryLimit', Number(e.target.value))}
                                        style={{ width: '75px', fontFamily: 'var(--font-mono)', padding: '4px 6px', fontSize: '0.85rem' }}
                                      />
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MB</span>
                                    </div>
                                  </td>

                                  {/* Test Case Count */}
                                  <td style={{ padding: '10px 10px' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                                      {testCount}
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '3px' }}>test</span>
                                  </td>

                                  {/* Actions */}
                                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                      <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        onClick={() => {
                                          setExpandedProblemCodes(prev => {
                                            const next = new Set(prev);
                                            next.has(prob.code) ? next.delete(prob.code) : next.add(prob.code);
                                            return next;
                                          });
                                        }}
                                        style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                                      >
                                        {isExpanded ? 'Thu gọn' : 'Xem test'}
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        onClick={() => handleDeleteImportedProblem(prob.code)}
                                        style={{ fontSize: '0.72rem', padding: '3px 8px', color: 'var(--accent-rose)', borderColor: 'rgba(239,68,68,0.3)' }}
                                        title="Xóa bài này"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {/* Tree view of test cases */}
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={6} style={{ padding: '12px 18px 14px 34px', background: 'rgba(0, 0, 0, 0.25)', borderBottom: '1px solid var(--border-subtle)' }}>
                                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', lineHeight: '2' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '4px' }}>
                                          {prob.code}/
                                        </div>
                                        {(prob.testCases || []).map((tc, idx) => {
                                          const isLast = idx === (prob.testCases?.length || 0) - 1;
                                          return (
                                            <div key={idx} style={{ color: 'var(--text-secondary)', paddingLeft: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                              <div>
                                                <span style={{ color: 'var(--text-muted)' }}>{isLast ? '└── ' : '├── '}</span>
                                                <strong style={{ color: 'var(--text-main)' }}>{tc.name}</strong>
                                                <span style={{ color: 'var(--accent-emerald)', marginLeft: '6px', fontWeight: 700 }}>✓</span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: '10px' }}>
                                                  ({prob.code}.inp, {prob.code}.out • {tc.points || 0} điểm)
                                                </span>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteTestCase(prob.code, idx)}
                                                title={`Xóa test ${tc.name}`}
                                                style={{
                                                  background: 'none',
                                                  border: 'none',
                                                  color: 'var(--text-muted)',
                                                  cursor: 'pointer',
                                                  padding: '2px 6px',
                                                  fontSize: '0.75rem',
                                                  borderRadius: '4px'
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                                              >
                                                <X size={13} />
                                              </button>
                                            </div>
                                          );
                                        })}
                                        <div style={{ marginTop: '8px', paddingLeft: '8px', fontWeight: 600, color: 'var(--accent-emerald)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <CheckCircle2 size={14} /> Tổng: {testCount} Test Case ({prob.points ?? (prob.testCases || []).reduce((sum, t) => sum + (t.points || 0), 0)} điểm)
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {/* Mode 1: Folder Card */}
                    <div 
                      style={{
                        border: '1.5px dashed var(--border-medium)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '24px 16px',
                        textAlign: 'center',
                        background: 'rgba(255,255,255,0.015)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => folderInputRef.current?.click()}
                    >
                      <FolderUp size={30} color="var(--accent-emerald)" style={{ marginBottom: '8px' }} />
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                        Trường hợp 1: Chọn Thư Mục (Folder)
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                        Chọn thư mục <code>TestCases/</code> (chứa nhiều bài) hoặc folder bài <code>bai1/</code>. Hệ thống sẽ tự quét và ghép test tự động.
                      </div>
                    </div>

                    {/* Mode 2: Individual Files Card */}
                    <div 
                      style={{
                        border: '1.5px dashed var(--border-medium)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '24px 16px',
                        textAlign: 'center',
                        background: 'rgba(255,255,255,0.015)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileCheck size={30} color="var(--accent-cyan)" style={{ marginBottom: '8px' }} />
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                        Trường hợp 2: Chọn Test Riêng Lẻ
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                        Chọn trực tiếp các file <code>bai1.inp</code> và <code>bai1.out</code> riêng lẻ. Hệ thống sẽ tự ghép thành Test Case cho bài tương ứng.
                      </div>
                    </div>
                  </div>
                )}

                {/* Option to hide test details from students */}
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input 
                      type="checkbox"
                      checked={formContest.hideTestDetailsForStudents !== false}
                      onChange={e => setFormContest({ ...formContest, hideTestDetailsForStudents: e.target.checked })}
                      style={{ marginTop: '2px' }}
                    />
                    <span>
                      <strong>Ẩn chi tiết Input / Output đối với thí sinh khi đang thi</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: '2px' }}>
                        Thí sinh chỉ biết Đúng / Sai ở từng Test Case (Ví dụ: Test 01: Đúng, Test 03: Sai — 3/5 Test), không xem được nội dung file .inp/.out để đảm bảo tính nghiêm túc của kỳ thi thật. Giáo viên vẫn xem được đầy đủ chi tiết.
                      </div>
                    </span>
                  </label>
                </div>

                {/* Backward compatibility: Optional library selection toggle */}
                {problems.length > 0 && (
                  <details style={{ marginTop: '12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <summary style={{ cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)' }}>
                      Hoặc chọn thêm bài từ kho bài tập có sẵn ({problems.length} bài trong kho)
                    </summary>
                    <div style={{ marginTop: '8px', padding: '10px', background: 'var(--bg-surface)', borderRadius: '4px', border: '1px solid var(--border-subtle)', maxHeight: '140px', overflowY: 'auto' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {problems.map(p => {
                          const checked = (formContest.problemIds || []).includes(p.id);
                          return (
                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => {
                                  const cur = new Set(formContest.problemIds || []);
                                  e.target.checked ? cur.add(p.id) : cur.delete(p.id);
                                  setFormContest({ ...formContest, problemIds: Array.from(cur) });
                                }}
                              />
                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>[{p.code}]</span>
                              <span>{p.title}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>({p.testCases?.length || 0}t)</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </details>
                )}
              </div>

              {/* 5. Class Selection */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  LỚP HỌC ĐƯỢC THAM GIA
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={(formContest.classIds || []).length === 0}
                      onChange={e => {
                        if (e.target.checked) setFormContest({ ...formContest, classIds: [] });
                      }}
                    />
                    <strong>Tất cả các lớp</strong>
                  </label>

                  {classes.map(cls => {
                    const checked = (formContest.classIds || []).includes(cls.id);
                    return (
                      <label key={cls.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            let next = [...(formContest.classIds || [])];
                            if (e.target.checked) {
                              next.push(cls.id);
                            } else {
                              next = next.filter(id => id !== cls.id);
                            }
                            setFormContest({ ...formContest, classIds: next });
                          }}
                        />
                        <span>{cls.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 6. Score & Timing Settings */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    TỔNG ĐIỂM KỲ THI *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    className="input-field"
                    value={formContest.totalScore || 100}
                    onChange={e => setFormContest({ ...formContest, totalScore: Number(e.target.value) })}
                    required
                    style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    THỜI LƯỢNG LÀM BÀI (PHÚT) *
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={360}
                    className="input-field"
                    value={formContest.durationMinutes || 45}
                    onChange={e => setFormContest({ ...formContest, durationMinutes: Number(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    THỜI GIAN MỞ (BẮT ĐẦU) *
                  </label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={formContest.startTime || ''}
                    onChange={e => setFormContest({ ...formContest, startTime: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    THỜI GIAN ĐÓNG (KẾT THÚC) *
                  </label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={formContest.endTime || ''}
                    onChange={e => setFormContest({ ...formContest, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* 7. Grading & Anti-Cheat Settings */}
              <div style={{ background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>HÌNH THỨC CHẤM & BẢO MẬT PHÒNG THI</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Hình thức công bố kết quả:
                    </label>
                    <select
                      className="input-field"
                      value={formContest.gradingMode || 'direct'}
                      onChange={e => setFormContest({ ...formContest, gradingMode: e.target.value as any })}
                    >
                      <option value="direct">Chấm trực tiếp (Học sinh xem điểm & Diff ngay)</option>
                      <option value="batch_after_deadline">Chế độ Olympic (Chỉ nộp bài, chấm sau khi hết giờ)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Đóng băng Bảng điểm (phút cuối):
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      className="input-field"
                      value={formContest.freezeScoreboardMinutes || 0}
                      onChange={e => setFormContest({ ...formContest, freezeScoreboardMinutes: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* File I/O (freopen) & IP Whitelist settings */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input
                      type="checkbox"
                      checked={!!formContest.requireFreopen}
                      onChange={e => setFormContest({ ...formContest, requireFreopen: e.target.checked })}
                      style={{ marginTop: '2px' }}
                    />
                    <span>
                      <strong style={{ color: formContest.requireFreopen ? 'var(--accent-amber)' : 'var(--text-main)' }}>
                        Yêu cầu thí sinh dùng tệp nhập/xuất (freopen)
                      </strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: '2px' }}>
                        Bắt buộc mã nguồn thí sinh phải mở đúng tệp <code>&lt;TÊN_BÀI&gt;.inp</code> để đọc và <code>&lt;TÊN_BÀI&gt;.out</code> để ghi. Nếu không có freopen hoặc sai tên tệp sẽ báo lỗi không tìm thấy tệp kết quả (WA). Bỏ chọn nếu cho phép nhập xuất tự do qua bàn phím (cin/cout).
                      </div>
                    </span>
                  </label>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Khóa dải IP phòng thi (IP Whitelist):
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Ví dụ: 192.168.1.* hoặc 192.168.1.10-50 (để trống = cho phép mọi máy)"
                      value={formContest.ipWhitelist || ''}
                      onChange={e => setFormContest({ ...formContest, ipWhitelist: e.target.value })}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                    />
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>
                      Chỉ cho phép các máy tính có IP thuộc danh sách trên được nộp bài. Có thể nhập nhiều dải IP cách nhau bởi dấu phẩy.
                    </div>
                  </div>
                </div>

                {/* Online Anti-Cheat specifics */}
                {formContest.mode === 'online' && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      TÍNH NĂNG CHỐNG GIAN LẬN KHI THI ONLINE:
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formContest.antiCheat?.preventTabSwitch !== false}
                        onChange={e => setFormContest({
                          ...formContest,
                          antiCheat: { ...formContest.antiCheat!, preventTabSwitch: e.target.checked }
                        })}
                      />
                      <span>Cảnh báo và đếm số lần học sinh chuyển tab / rời khỏi cửa sổ làm bài (Tối đa: {formContest.antiCheat?.maxTabViolations || 3} lần)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formContest.antiCheat?.preventCopyPaste !== false}
                        onChange={e => setFormContest({
                          ...formContest,
                          antiCheat: { ...formContest.antiCheat!, preventCopyPaste: e.target.checked }
                        })}
                      />
                      <span>Khóa thao tác dán mã nguồn từ bên ngoài (Chống copy-paste code)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Live Point Matching Validation */}
              {importedFolderProblems.length > 0 && (() => {
                const contestTotal = Number(formContest.totalScore) || 100;
                const currentSum = importedFolderProblems.reduce((s, p) => s + (Number(p.points) || 0), 0);
                const isMatch = currentSum === contestTotal;
                return (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${isMatch ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                    background: isMatch ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem' }}>
                      <span style={{ fontWeight: 700, color: isMatch ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                        {isMatch ? '✓ TỔNG ĐIỂM CHUẨN XÁC:' : '⚠ TỔNG ĐIỂM CHƯA KHỚP:'}
                      </span>
                      <span style={{ color: 'var(--text-main)' }}>
                        Tổng điểm {importedFolderProblems.length} bài toán = <strong style={{ color: isMatch ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>{currentSum}đ</strong> / Tổng điểm kỳ thi = <strong>{contestTotal}đ</strong>
                        {!isMatch && ` (${currentSum < contestTotal ? `Thiếu ${contestTotal - currentSum}đ` : `Thừa ${currentSum - contestTotal}đ`})`}
                      </span>
                    </div>
                    {!isMatch && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={handleDistributePoints}
                        style={{ borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)', fontSize: '0.78rem', padding: '4px 10px' }}
                      >
                        ⚖ Tự Động Chia Đều Điểm
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Submit Buttons & Draft Management */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                {!editingContestId ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="btn btn-outline btn-sm" 
                      onClick={handleManualSaveDraft}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem' }}
                      title="Lưu thủ công bản nháp ngay bây giờ"
                    >
                      <Save size={13} /> Lưu Bản Nháp
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline btn-sm" 
                      onClick={handleClearDraft}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: 'var(--accent-rose)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      title="Xóa bản nháp và bắt đầu lại form trống"
                    >
                      <Trash2 size={13} /> Xóa Bản Nháp
                    </button>
                  </div>
                ) : <div />}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="btn btn-outline" onClick={handleCloseModalWithCheck}>
                    Huỷ Bỏ
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px 22px', fontWeight: 700 }}>
                    {editingContestId ? 'Lưu Thay Đổi' : 'Tạo Kỳ Thi'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: QUẢN LÝ ĐỀ & TEST CASES CỦA RIÊNG KỲ THI (Quick Manager) ── */}
      {quickManageContest && (
        <div className="modal-overlay" onClick={() => setQuickManageContest(null)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '820px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={20} style={{ color: 'var(--accent-cyan)' }} />
                  <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Đề Bài & Test Cases: {quickManageContest.title}</h3>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Thêm, xóa bài tập và trực tiếp quản lý bộ test case cho kỳ thi này
                </div>
              </div>

              <button className="btn btn-outline btn-sm" onClick={() => setQuickManageContest(null)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setFormContest(quickManageContest);
                  setEditingContestId(quickManageContest.id);
                  setProblemPickerTab('create_direct');
                  setQuickManageContest(null);
                  setIsModalOpen(true);
                }}
              >
                <Plus size={14} /> Tạo Bài Mới & Nạp Test Vào Kỳ Thi
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => openSampleModal()}
              >
                <FolderDown size={14} /> Nạp Bài Từ Thư Mục TEST/
              </button>

              {quickManageContest.pdfUrl && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setPdfViewerModal({ title: quickManageContest.title, url: `${serverUrl}${quickManageContest.pdfUrl}`, fileName: quickManageContest.pdfFileName })}
                >
                  <FileText size={14} color="#f87171" /> Xem Đề Thi PDF
                </button>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {(quickManageContest.problemIds || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Kỳ thi này chưa có bài tập nào. Hãy bấm nút tạo bài mới ở trên!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {quickManageContest.problemIds.map((pId, idx) => {
                    const prob = problems.find(p => p.id === pId || p.code === pId);
                    return (
                      <div 
                        key={pId}
                        style={{
                          padding: '12px 16px',
                          background: 'var(--bg-surface)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.85rem' }}>#{idx + 1}</span>
                            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>[{prob ? prob.code : pId}]</strong>
                            <span style={{ fontWeight: 600 }}>{prob ? prob.title : 'Bài tập không xác định'}</span>
                            {prob?.pdfUrl && (
                              <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '0.7rem' }}>
                                Có Đề PDF
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Bộ test: <strong>{prob?.testCases?.length || 0} test cases</strong> • Điểm: {prob?.points || 100}đ • Time: {prob?.timeLimit || 1000}ms
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          {prob && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => openTcManager(prob)}
                              style={{ fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Layers size={13} /> Test Cases ({prob.testCases?.length || 0})
                            </button>
                          )}
                          {prob?.pdfUrl && (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => setPdfViewerModal({ title: prob.title, url: `${serverUrl}${prob.pdfUrl}`, fileName: prob.pdfFileName })}
                              title="Xem đề PDF"
                            >
                              <FileText size={13} />
                            </button>
                          )}
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ color: 'var(--accent-rose)' }}
                            onClick={async () => {
                              if (!confirm(`Gỡ bài "${prob?.title || pId}" khỏi kỳ thi này?`)) return;
                              const updatedProblemIds = quickManageContest.problemIds.filter(id => id !== pId);
                              await fetch(`${serverUrl}/api/contests/${quickManageContest.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ problemIds: updatedProblemIds })
                              });
                              setQuickManageContest({ ...quickManageContest, problemIds: updatedProblemIds });
                              fetchInitialData();
                            }}
                            title="Gỡ khỏi kỳ thi"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: TEST CASE MANAGER CHO BÀI TẬP ──────────────── */}
      {tcModalProblem && (
        <div className="modal-overlay" onClick={() => setTcModalProblem(null)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '820px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={20} style={{ color: 'var(--accent-cyan)' }} />
                  <h3 style={{ fontSize: '1.2rem', margin: 0 }}>
                    Quản Lý Test Cases: [{tcModalProblem.code}] {tcModalProblem.title}
                  </h3>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Tổng cộng: {tcList.length} test cases • Điểm: {tcList.reduce((s, tc) => s + (tc.score || 0), 0)} / {tcModalProblem.points || 100}đ
                </div>
              </div>

              <button className="btn btn-outline btn-sm" onClick={() => setTcModalProblem(null)}>
                <X size={15} />
              </button>
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsAddingTcToModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Plus size={14} /> Thêm Test Case
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    if (tcList.length === 0) return;
                    const each = Math.max(1, Math.round(100 / tcList.length));
                    setTcList(tcList.map(tc => ({ ...tc, score: each })));
                  }}
                  title="Tự động chia đều 100 điểm cho các test"
                >
                  ⚡ Chia Đều Điểm
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {tcSaveSuccess && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={15} /> Đã lưu thành công!
                  </span>
                )}
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveTcList}
                  disabled={savingTcList}
                  style={{ padding: '6px 18px', fontWeight: 700 }}
                >
                  {savingTcList ? 'Đang Lưu...' : '💾 Lưu Bộ Test'}
                </button>
              </div>
            </div>

            {/* Inline Add Test Form */}
            {isAddingTcToModal && (
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '14px', border: '1px solid var(--border-medium)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>TÊN TEST CASE</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder={`test${String(tcList.length + 1).padStart(2, '0')}`}
                      value={modalNewTc.name}
                      onChange={e => setModalNewTc({ ...modalNewTc, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ĐIỂM SỐ</label>
                    <input
                      type="number"
                      className="input-field"
                      value={modalNewTc.score}
                      onChange={e => setModalNewTc({ ...modalNewTc, score: Number(e.target.value) })}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={modalNewTc.isSample}
                        onChange={e => setModalNewTc({ ...modalNewTc, isSample: e.target.checked })}
                      />
                      <span>Test Ví Dụ (Công khai)</span>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>INPUT ({tcModalProblem.code.toLowerCase()}.inp)</label>
                    <textarea
                      className="input-field"
                      rows={3}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                      placeholder="Dữ liệu vào..."
                      value={modalNewTc.input}
                      onChange={e => setModalNewTc({ ...modalNewTc, input: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>EXPECTED OUTPUT ({tcModalProblem.code.toLowerCase()}.out)</label>
                    <textarea
                      className="input-field"
                      rows={3}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                      placeholder="Kết quả chuẩn..."
                      value={modalNewTc.expectedOutput}
                      onChange={e => setModalNewTc({ ...modalNewTc, expectedOutput: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setIsAddingTcToModal(false)}>
                    Hủy
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={handleAddTcToModal}>
                    <Check size={13} /> Thêm Vào Danh Sách
                  </button>
                </div>
              </div>
            )}

            {/* Test Cases Table */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {tcList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Bài tập này chưa có test case nào. Hãy thêm test case mới!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {tcList.map((tc, idx) => (
                    <div 
                      key={tc.id || idx}
                      style={{
                        padding: '10px 14px',
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.8rem', width: '20px' }}>
                          #{idx + 1}
                        </span>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                              {tc.name || `test${idx + 1}`}
                            </strong>
                            {tc.isSample && (
                              <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(56,189,248,0.2)', color: '#38bdf8' }}>
                                Test mẫu
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                            In: {tc.input ? tc.input.replace(/\n/g, ' ').slice(0, 30) : '(trống)'} • Out: {tc.expectedOutput ? tc.expectedOutput.replace(/\n/g, ' ').slice(0, 30) : '(trống)'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Điểm:</span>
                          <input
                            type="number"
                            style={{ width: '60px', padding: '3px 6px', fontSize: '0.8rem', textAlign: 'center' }}
                            className="input-field"
                            value={tc.score || 0}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setTcList(tcList.map((item, i) => i === idx ? { ...item, score: val } : item));
                            }}
                          />
                        </div>

                        <button
                          className="btn btn-outline btn-sm"
                          style={{ color: 'var(--accent-rose)', padding: '5px' }}
                          onClick={() => setTcList(tcList.filter((_, i) => i !== idx))}
                          title="Xóa test case"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: NẠP ĐỀ MẪU TỪ THƯ MỤC TEST (LUCKY, PLAN, TEAM) ─ */}
      {sampleModalOpen && (
        <div className="modal-overlay" onClick={() => setSampleModalOpen(false)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '720px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderDown size={20} style={{ color: 'var(--primary-light)' }} />
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Nạp Đề Mẫu Từ Thư Mục TEST/</h3>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setSampleModalOpen(false)}>
                <X size={15} />
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Hệ thống tự động phát hiện các bài tập có sẵn trong thư mục <strong>TEST/</strong> (bao gồm toàn bộ test case .inp/.out và file đề bài PDF). Bấm nạp để tự động đưa vào đề thi!
            </p>

            {sampleImportMsg && (
              <div style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '14px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> {sampleImportMsg}
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {sampleLoading ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Đang quét thư mục TEST/...</div>
              ) : sampleProblems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  Không tìm thấy bài tập nào trong thư mục TEST/.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sampleProblems.map(sp => (
                    <div 
                      key={sp.folder}
                      style={{
                        padding: '14px 16px',
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontSize: '1rem' }}>
                            {sp.folder}
                          </strong>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            {sp.title || `Bài tập ${sp.folder}`}
                          </span>
                          {sp.hasPdf && (
                            <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '0.7rem' }}>
                              📄 Có Đề PDF ({sp.pdfFileName})
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          Số lượng testcase có sẵn: <strong>{sp.testCount} tests</strong> ({sp.folder.toLowerCase()}.inp & .out)
                        </div>
                      </div>

                      <button
                        className="btn btn-primary btn-sm"
                        disabled={importingSample}
                        onClick={() => handleImportSampleToContest(sp.folder)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Plus size={13} /> Nạp Vào Kỳ Thi
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={importingSample || sampleProblems.length === 0}
                onClick={() => handleImportSampleToContest(undefined, true)}
              >
                Nạp Tất Cả ({sampleProblems.length} Bài) Vào Đề Thi
              </button>

              <button className="btn btn-outline btn-sm" onClick={() => setSampleModalOpen(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: XEM TRỰC TIẾP FILE ĐỀ THI / ĐỀ BÀI ─────── */}
      {pdfViewerModal && (
        <div className="modal-overlay" onClick={() => setPdfViewerModal(null)}>
          <div 
            className="glass-panel" 
            style={{ width: '95%', maxWidth: '980px', height: '88vh', display: 'flex', flexDirection: 'column', padding: '20px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="var(--accent-rose)" />
                <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Xem Đề Bài: {pdfViewerModal.title}</h3>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <a 
                  href={pdfViewerModal.url}
                  download={pdfViewerModal.fileName || 'de_thi'}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                >
                  <Download size={13} /> Tải Về Máy
                </a>
                <button className="btn btn-outline btn-sm" onClick={() => setPdfViewerModal(null)}>
                  <X size={15} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
              <StatementViewer 
                src={pdfViewerModal.url}
                fileName={pdfViewerModal.fileName}
                title={pdfViewerModal.title}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: BẢNG ĐIỂM KỲ THI ──────────────────────────── */}
      {leaderboardContest && (
        <div className="modal-overlay" onClick={() => setLeaderboardContest(null)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '850px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Trophy size={20} style={{ color: 'var(--accent-amber)' }} />
                  <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Bảng Điểm Kỳ Thi: {leaderboardContest.title}</h3>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Chế độ: <strong>{leaderboardContest.mode === 'offline' ? 'Offline (Mạng LAN)' : 'Online (Internet)'}</strong> • Thời lượng: {leaderboardContest.durationMinutes} phút
                </div>
              </div>

              <button className="btn btn-outline btn-sm" onClick={() => setLeaderboardContest(null)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingScores ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tính toán bảng điểm...</div>
              ) : contestScores.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Chưa có thí sinh nào nộp bài trong kỳ thi này.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px 14px' }}>HẠNG</th>
                      <th style={{ padding: '10px 14px' }}>THÍ SINH</th>
                      <th style={{ padding: '10px 14px' }}>TỔNG ĐIỂM</th>
                      <th style={{ padding: '10px 14px' }}>SỐ BÀI GIẢI ĐƯỢC</th>
                      <th style={{ padding: '10px 14px' }}>LẦN NỘP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contestScores.map((entry, idx) => (
                      <tr key={entry.userId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 800 }}>
                          {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                          {entry.userName}
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>@{entry.username}</span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--accent-emerald)', fontSize: '0.95rem' }}>
                          {entry.totalScore}
                        </td>
                        <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>
                          {entry.problemsSolved} bài
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                          {entry.totalSubmissions}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── MODAL: TẠO BẢNG ĐIỂM CHÍNH THỨC (BÁO CÁO CHỈ REAL PARTICIPANTS) ─ */}
      {officialReportModal && (
        <div className="modal-overlay" onClick={() => setOfficialReportModal(null)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '820px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: '26px' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header with Print & Export actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', borderBottom: '1px solid var(--border-medium)', paddingBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCheck size={22} style={{ color: 'var(--accent-emerald)' }} />
                  <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800 }}>
                    BẢNG ĐIỂM BÁO CÁO KỲ THI
                  </h3>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Kỳ thi: <strong>{officialReportModal.contestTitle}</strong> • Chỉ tính thí sinh <strong>Tham gia chính thức (REAL)</strong>, loại bỏ bài thi ảo
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={`${serverUrl}/api/contests/${officialReportModal.contestId}/export-official-csv`}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', textDecoration: 'none' }}
                  title="Xuất bảng điểm ra file Excel / CSV"
                >
                  <FileSpreadsheet size={14} color="var(--accent-emerald)" /> Xuất Excel
                </a>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (!printWindow) {
                      alert('Vui lòng cho phép mở cửa sổ popup để in bảng điểm!');
                      return;
                    }
                    printWindow.document.write(`
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <title>Bảng Điểm - ${officialReportModal.contestTitle}</title>
                        <meta charset="utf-8" />
                        <style>
                          body { font-family: 'Times New Roman', Times, serif; padding: 40px; color: #000; }
                          .header { text-align: center; margin-bottom: 24px; }
                          .header h3 { margin: 0 0 4px 0; text-transform: uppercase; font-size: 14pt; }
                          .header h2 { margin: 0 0 6px 0; text-transform: uppercase; font-size: 18pt; font-weight: bold; }
                          .header p { margin: 0; font-size: 11pt; font-style: italic; }
                          table { width: 100%; border-collapse: collapse; margin-top: 18px; }
                          th, td { border: 1px solid #000; padding: 8px 10px; font-size: 12pt; text-align: left; }
                          th { background: #f2f2f2; text-align: center; font-weight: bold; }
                          .center { text-align: center; }
                          .footer { margin-top: 50px; display: flex; justify-content: flex-end; }
                          .footer-sign { text-align: center; font-size: 12pt; }
                        </style>
                      </head>
                      <body>
                        <div class="header">
                          <h3>TRƯỜNG TH-THCS-THPT TRÍ ĐỨC</h3>
                          <h2>BẢNG ĐIỂM KỲ THI</h2>
                          <h3>${officialReportModal.contestTitle}</h3>
                          <p>Thời gian: ${new Date().toLocaleDateString('vi-VN')} | Tổng số thí sinh: ${officialReportModal.rows?.length || 0}</p>
                        </div>
                        <table>
                          <thead>
                            <tr>
                              <th style="width: 10%;">STT</th>
                              <th style="width: 50%;">HỌ VÀ TÊN</th>
                              <th style="width: 20%;">LỚP</th>
                              <th style="width: 20%;">ĐIỂM</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${(officialReportModal.rows || []).map((r: any) => `
                              <tr>
                                <td class="center">${r.stt}</td>
                                <td><strong>${r.fullName}</strong></td>
                                <td class="center">${r.className}</td>
                                <td class="center" style="font-weight: bold;">${r.score}</td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                        <div class="footer">
                          <div class="footer-sign">
                            <p style="font-style: italic; margin-bottom: 40px;">Ngày ...... tháng ...... năm 20...</p>
                            <p><strong>NGƯỜI LẬP BẢNG</strong></p>
                            <p style="margin-top: 50px;">(Ký và ghi rõ họ tên)</p>
                          </div>
                        </div>
                        <script>
                          window.onload = function() { window.print(); }
                        </script>
                      </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}
                  title="In trực tiếp hoặc Lưu dưới dạng PDF"
                >
                  <Printer size={14} /> In / Xuất PDF
                </button>

                <button className="btn btn-outline btn-sm" onClick={() => setOfficialReportModal(null)}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Document sheet view */}
            <div style={{ flex: 1, overflowY: 'auto', background: '#ffffff', color: '#0f172a', padding: '28px 32px', borderRadius: '4px', border: '1px solid #cbd5e1', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
              <div style={{ textAlign: 'center', marginBottom: '22px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em', color: '#475569', textTransform: 'uppercase' }}>
                  TRƯỜNG TH-THCS-THPT TRÍ ĐỨC
                </div>
                <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '6px 0', color: '#0f172a', textTransform: 'uppercase' }}>
                  BẢNG ĐIỂM KỲ THI
                </h2>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1d4ed8' }}>
                  {officialReportModal.contestTitle}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                  Thời gian: {new Date().toLocaleDateString('vi-VN')} • Xếp loại điểm chính thức
                </div>
              </div>

              {(!officialReportModal.rows || officialReportModal.rows.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '0.9rem' }}>
                  Chưa có thí sinh chính thức nào tham gia hoặc nộp bài trong kỳ thi này.
                </div>
              ) : (
                <div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#1e293b' }}>
                        <th style={{ padding: '10px 14px', width: '12%', textAlign: 'center', border: '1px solid #cbd5e1', fontWeight: 700 }}>STT</th>
                        <th style={{ padding: '10px 14px', width: '48%', border: '1px solid #cbd5e1', fontWeight: 700 }}>HỌ VÀ TÊN</th>
                        <th style={{ padding: '10px 14px', width: '20%', textAlign: 'center', border: '1px solid #cbd5e1', fontWeight: 700 }}>LỚP</th>
                        <th style={{ padding: '10px 14px', width: '20%', textAlign: 'center', border: '1px solid #cbd5e1', fontWeight: 700 }}>ĐIỂM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {officialReportModal.rows.map((row: any) => (
                        <tr key={row.stt} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '9px 12px', textAlign: 'center', border: '1px solid #cbd5e1', fontWeight: 600, color: '#475569' }}>
                            {row.stt}
                          </td>
                          <td style={{ padding: '9px 12px', border: '1px solid #cbd5e1', fontWeight: 700, color: '#0f172a' }}>
                            {row.fullName}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'center', border: '1px solid #cbd5e1', color: '#334155' }}>
                            {row.className}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'center', border: '1px solid #cbd5e1', fontWeight: 800, color: '#059669', fontSize: '1rem' }}>
                            {row.score}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ textAlign: 'center', fontSize: '0.88rem', color: '#334155', minWidth: '220px' }}>
                      <div style={{ fontStyle: 'italic', marginBottom: '40px', color: '#64748b' }}>
                        Ngày ...... tháng ...... năm 20...
                      </div>
                      <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>
                        Người lập bảng
                      </div>
                      <div style={{ marginTop: '50px', fontSize: '0.8rem', color: '#94a3b8' }}>
                        (Ký và ghi rõ họ tên)
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

