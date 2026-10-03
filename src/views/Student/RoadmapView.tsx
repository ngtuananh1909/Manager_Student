import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../lib/api';
import { RoadmapTopic, RoadmapExercise, Problem } from '../../types';
import { useNetwork } from '../../context/NetworkContext';
import { 
  Compass, 
  CheckCircle2, 
  Circle, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  Award, 
  BookOpen, 
  Sparkles, 
  Flame, 
  ArrowRight,
  Target,
  Trophy,
  Code2,
  Terminal,
  Cpu,
  Layers,
  Search,
  Filter
} from 'lucide-react';

interface Props {
  onSelectProblem?: (problem: Problem) => void;
}

export const RoadmapView: React.FC<Props> = ({ onSelectProblem }) => {
  const { serverUrl } = useNetwork();
  const [topics, setTopics] = useState<RoadmapTopic[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchRoadmapData();
  }, [serverUrl]);

  const fetchRoadmapData = async () => {
    try {
      setLoading(true);
      const [resRoadmap, resProblems] = await Promise.all([
        apiFetch(`${serverUrl}/api/roadmap`),
        apiFetch(`${serverUrl}/api/problems`)
      ]);

      if (resRoadmap.ok) {
        const roadmapData = await resRoadmap.json();
        setTopics(roadmapData);
        if (roadmapData.length > 0 && !expandedTopicId) {
          // Auto-expand the first uncompleted topic or first topic
          const firstUnfinished = roadmapData.find((t: RoadmapTopic) => (t.progressPercent || 0) < 100);
          setExpandedTopicId(firstUnfinished ? firstUnfinished.id : roadmapData[0].id);
        }
      }

      if (resProblems.ok) {
        const probData = await resProblems.json();
        setProblems(probData);
      }
    } catch (err) {
      console.error('Failed to load roadmap:', err);
    } finally {
      setLoading(false);
    }
  };

  // Overall Statistics
  const overallStats = useMemo(() => {
    let totalExercises = 0;
    let completedExercises = 0;
    topics.forEach(t => {
      totalExercises += t.total || 0;
      completedExercises += t.completed || 0;
    });

    const percent = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;

    let rankTitle = 'Người Mới Bắt Đầu';
    let rankColor = 'var(--text-secondary)';
    if (percent >= 90) {
      rankTitle = 'Bậc Thầy Thuật Toán (Grandmaster)';
      rankColor = 'var(--accent-amber)';
    } else if (percent >= 60) {
      rankTitle = 'Cao Thủ Lập Trình (Expert)';
      rankColor = '#c084fc';
    } else if (percent >= 30) {
      rankTitle = 'Chiến Binh Code (Warrior)';
      rankColor = 'var(--accent-cyan)';
    } else if (percent > 0) {
      rankTitle = 'Tập Sự C++ (Apprentice)';
      rankColor = 'var(--accent-emerald)';
    }

    return { totalExercises, completedExercises, percent, rankTitle, rankColor };
  }, [topics]);

  // Filtered topics
  const filteredTopics = useMemo(() => {
    return topics.filter(t => {
      const matchLevel = levelFilter === 'all' || t.level === levelFilter;
      const matchSearch = !searchQuery || 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.exercises || []).some(e => e.code.toLowerCase().includes(searchQuery.toLowerCase()) || e.title.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchLevel && matchSearch;
    });
  }, [topics, levelFilter, searchQuery]);

  const handleStartExercise = (exercise: RoadmapExercise) => {
    const fullProb = problems.find(p => p.code === exercise.code);
    if (fullProb && onSelectProblem) {
      onSelectProblem(fullProb);
    } else {
      alert(`Bài tập [${exercise.code}] hiện chưa có sẵn trong danh mục đề.`);
    }
  };

  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Compass size={24} color="var(--accent-cyan)" /> Lộ Trình Luyện Tập Thuật Toán (Roadmap)
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
            Lộ trình từng bước từ Nhập xuất cơ bản đến Quy hoạch động nâng cao. Hoàn thành bài tập để chinh phục các mốc kỹ năng!
          </p>
        </div>
      </div>

      {/* Hero KPI Card */}
      <div className="glass-card" style={{ padding: '20px 24px', marginBottom: '24px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              TIẾN ĐỘ CHINH PHỤC LỘ TRÌNH
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '6px' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {overallStats.completedExercises} <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>/ {overallStats.totalExercises} Bài</span>
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                ({overallStats.percent}%)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '0.84rem' }}>
              <Award size={16} style={{ color: overallStats.rankColor }} />
              <span style={{ color: 'var(--text-secondary)' }}>Danh hiệu hiện tại:</span>
              <strong style={{ color: overallStats.rankColor }}>{overallStats.rankTitle}</strong>
            </div>
          </div>

          <div style={{ width: '280px', maxWidth: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              <span>Hoàn thành lộ trình</span>
              <span>{overallStats.percent}%</span>
            </div>
            <div style={{ width: '100%', height: '10px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  height: '100%', 
                  width: `${overallStats.percent}%`, 
                  background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-emerald))', 
                  borderRadius: '999px',
                  transition: 'width 0.5s ease'
                }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text"
            className="input-field"
            placeholder="Tìm chủ đề hoặc mã bài..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '34px', fontSize: '0.84rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, marginRight: '4px' }}>Cấp độ:</span>
          {['all', 'Cơ bản', 'Trung cấp', 'Nâng cao'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              style={{
                background: levelFilter === lvl ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                color: levelFilter === lvl ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${levelFilter === lvl ? 'var(--primary)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '4px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {lvl === 'all' ? 'Tất cả' : lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Roadmap Topics List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
          Đang tải lộ trình học tập...
        </div>
      ) : filteredTopics.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
          Không tìm thấy chủ đề nào phù hợp.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredTopics.map((topic, idx) => {
            const isExpanded = expandedTopicId === topic.id;
            const isCompleted = (topic.total || 0) > 0 && topic.completed === topic.total;
            const hasStarted = (topic.completed || 0) > 0;

            return (
              <div 
                key={topic.id}
                className="glass-panel"
                style={{ 
                  borderRadius: 'var(--radius-md)', 
                  border: isCompleted 
                    ? '1px solid rgba(34, 197, 94, 0.4)' 
                    : isExpanded 
                    ? '1px solid rgba(56, 189, 248, 0.4)' 
                    : '1px solid var(--border-subtle)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Topic Accordion Header */}
                <div 
                  onClick={() => setExpandedTopicId(isExpanded ? null : topic.id)}
                  style={{ 
                    padding: '16px 20px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: isExpanded ? 'var(--bg-surface-elevated)' : 'transparent',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ 
                      width: '36px', 
                      height: '36px', 
                      borderRadius: '8px', 
                      background: isCompleted ? 'rgba(34, 197, 94, 0.18)' : 'rgba(56, 189, 248, 0.12)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: isCompleted ? 'var(--accent-emerald)' : 'var(--accent-cyan)'
                    }}>
                      {isCompleted ? <CheckCircle2 size={20} /> : <Code2 size={20} />}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                          {topic.title}
                        </h3>
                        <span className={`badge ${
                          topic.level === 'Cơ bản' ? 'diff-tag-easy' : 
                          topic.level === 'Trung cấp' ? 'diff-tag-medium' : 'diff-tag-hard'
                        }`}>
                          {topic.level}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {topic.description}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Progress pill */}
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ 
                        fontSize: '0.82rem', 
                        fontWeight: 700, 
                        color: isCompleted ? 'var(--accent-emerald)' : hasStarted ? 'var(--accent-amber)' : 'var(--text-muted)' 
                      }}>
                        {topic.completed || 0} / {topic.total || 0} Bài
                      </span>
                      <div style={{ width: '80px', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', marginTop: '4px' }}>
                        <div 
                          style={{ 
                            height: '100%', 
                            width: `${topic.progressPercent || 0}%`, 
                            background: isCompleted ? 'var(--accent-emerald)' : 'var(--accent-cyan)', 
                            borderRadius: '999px' 
                          }} 
                        />
                      </div>
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                {/* Topic Exercise Body */}
                {isExpanded && (
                  <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-app)' }}>
                    {!topic.exercises || topic.exercises.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                        Chủ đề này chưa được giáo viên gán bài tập nào. Hãy quay lại sau nhé!
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                        {topic.exercises.map((ex, exIdx) => {
                          return (
                            <div 
                              key={ex.code || exIdx}
                              className="glass-card"
                              style={{ 
                                padding: '14px 16px', 
                                borderLeft: ex.isPassed ? '4px solid var(--accent-emerald)' : '4px solid var(--border-medium)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                gap: '12px'
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.88rem', color: 'var(--accent-cyan)' }}>
                                    {ex.code}
                                  </span>
                                  <span className={`badge ${
                                    ex.difficulty === 'Dễ' ? 'diff-tag-easy' : 
                                    ex.difficulty === 'Trung bình' ? 'diff-tag-medium' : 'diff-tag-hard'
                                  }`}>
                                    {ex.difficulty}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.4 }}>
                                  {ex.title}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                                <div>
                                  {ex.isPassed ? (
                                    <span style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <CheckCircle2 size={13} /> Đã AC (100đ)
                                    </span>
                                  ) : (ex.userScore || 0) > 0 ? (
                                    <span style={{ fontSize: '0.78rem', color: 'var(--accent-amber)', fontWeight: 700 }}>
                                      Điểm: {ex.userScore}đ
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                      Chưa làm
                                    </span>
                                  )}
                                </div>

                                <button 
                                  className="btn btn-primary btn-sm"
                                  style={{ 
                                    padding: '4px 12px', 
                                    fontSize: '0.78rem', 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '5px',
                                    background: ex.isPassed ? 'rgba(34, 197, 94, 0.2)' : 'var(--primary)',
                                    color: ex.isPassed ? 'var(--accent-emerald)' : '#fff',
                                    borderColor: ex.isPassed ? 'var(--accent-emerald)' : 'transparent'
                                  }}
                                  onClick={() => handleStartExercise(ex)}
                                >
                                  {ex.isPassed ? 'Làm Lại' : 'Làm Bài'} <ArrowRight size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
