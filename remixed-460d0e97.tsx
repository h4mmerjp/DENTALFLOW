import React, { useState } from 'react';
import { Play, Settings, Plus, ArrowRight, ArrowDown, GripVertical, Calendar } from 'lucide-react';

const DentalWorkflowApp = () => {
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [toothConditions, setToothConditions] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [workflow, setWorkflow] = useState([]);
  const [draggedNode, setDraggedNode] = useState(null);
  const [treatmentSchedule, setTreatmentSchedule] = useState([]); // [{date: '2025-07-15', treatments: []}]
  const [selectedTreatmentOptions, setSelectedTreatmentOptions] = useState({}); // {condition-teeth: treatmentIndex}
  const [treatmentGroupingMode, setTreatmentGroupingMode] = useState('individual'); // 'individual' or 'grouped'
  const [bulkConditionMode, setBulkConditionMode] = useState(false); // 一括病名設定モード
  
  // ユーザーカスタマイズ可能な病名マスター
  const [conditions, setConditions] = useState([
    { code: 'C1', name: 'C1（初期う蝕）', symbol: 'C1', color: 'bg-yellow-100 border-yellow-400 text-yellow-800' },
    { code: 'C2', name: 'C2（中等度う蝕）', symbol: 'C2', color: 'bg-orange-100 border-orange-400 text-orange-800' },
    { code: 'C3', name: 'C3（深在性う蝕）', symbol: 'C3', color: 'bg-red-100 border-red-400 text-red-800' },
    { code: 'C4', name: 'C4（残根）', symbol: 'C4', color: 'bg-red-200 border-red-600 text-red-900' },
    { code: 'pul', name: 'pul（歯髄炎）', symbol: 'pul', color: 'bg-pink-100 border-pink-400 text-pink-800' },
    { code: 'per', name: 'per（根尖性歯周炎）', symbol: 'per', color: 'bg-rose-100 border-rose-400 text-rose-800' },
    { code: 'P1', name: 'P1（軽度歯周病）', symbol: 'P1', color: 'bg-purple-100 border-purple-400 text-purple-800' },
    { code: 'P2', name: 'P2（中等度歯周病）', symbol: 'P2', color: 'bg-purple-100 border-purple-600 text-purple-900' },
    { code: '欠損', name: '欠損歯', symbol: '×', color: 'bg-gray-200 border-gray-500 text-gray-800' }
  ]);

  // ユーザーカスタマイズ可能な治療法マスター
  const [treatmentRules, setTreatmentRules] = useState({
    'C1': [{ name: 'フッ素塗布', duration: 1, steps: ['フッ素塗布'] }],
    'C2': [
      { name: 'レジン充填', duration: 1, steps: ['レジン充填'] },
      { name: 'インレー', duration: 2, steps: ['印象採得', 'セット'] }
    ],
    'C3': [
      { name: '抜髄', duration: 1, steps: ['抜髄'] },
      { name: '根管治療', duration: 3, steps: ['根管拡大・洗浄', '根管充填', '仮封'] },
      { name: 'クラウン', duration: 3, steps: ['支台築造', '印象採得', 'セット'] }
    ],
    'pul': [
      { name: '抜髄', duration: 1, steps: ['抜髄'] },
      { name: '根管治療', duration: 3, steps: ['根管拡大・洗浄', '根管充填', '仮封'] },
      { name: 'クラウン', duration: 3, steps: ['支台築造', '印象採得', 'セット'] }
    ],
    'per': [
      { name: '感染根管治療', duration: 4, steps: ['根管開放', '根管拡大・洗浄①', '根管拡大・洗浄②', '根管充填'] },
      { name: 'クラウン', duration: 3, steps: ['支台築造', '印象採得', 'セット'] }
    ],
    'P1': [{ name: 'スケーリング', duration: 1, steps: ['スケーリング'] }],
    'P2': [
      { name: 'SRP', duration: 2, steps: ['SRP右側', 'SRP左側'] },
      { name: '再評価', duration: 1, steps: ['再評価'] }
    ]
  });

  // 設定編集用の状態
  const [newCondition, setNewCondition] = useState({ code: '', name: '', symbol: '', color: 'bg-gray-100 border-gray-400 text-gray-800' });
  const [newTreatment, setNewTreatment] = useState({ conditionCode: '', name: '', duration: 1, steps: [''] });
  const [autoScheduleEnabled, setAutoScheduleEnabled] = useState(true); // 自動スケジューリング設定
  const [aiPrompt, setAiPrompt] = useState('患者の痛みを最優先に、急性症状から治療してください。根管治療は週1回ペース、補綴物は2週間隔で進めてください。'); // AIプロンプト
  const [isGeneratingWorkflow, setIsGeneratingWorkflow] = useState(false); // AI生成中フラグ

  // 永久歯の番号（上顎右→左、下顎左→右）
  const teethNumbers = [
    [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
    [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
  ];

  // 新しい病名を追加
  const addCondition = () => {
    if (newCondition.code && newCondition.name && newCondition.symbol) {
      setConditions(prev => [...prev, { ...newCondition }]);
      setNewCondition({ code: '', name: '', symbol: '', color: 'bg-gray-100 border-gray-400 text-gray-800' });
    }
  };

  // 病名を削除
  const deleteCondition = (code) => {
    setConditions(prev => prev.filter(c => c.code !== code));
    // 関連する治療法も削除
    setTreatmentRules(prev => {
      const newRules = { ...prev };
      delete newRules[code];
      return newRules;
    });
  };

  // 新しい治療法を追加
  const addTreatment = () => {
    if (newTreatment.conditionCode && newTreatment.name && newTreatment.steps.some(step => step.trim())) {
      const filteredSteps = newTreatment.steps.filter(step => step.trim());
      setTreatmentRules(prev => ({
        ...prev,
        [newTreatment.conditionCode]: [
          ...(prev[newTreatment.conditionCode] || []),
          {
            name: newTreatment.name,
            duration: filteredSteps.length,
            steps: filteredSteps
          }
        ]
      }));
      setNewTreatment({ conditionCode: '', name: '', duration: 1, steps: [''] });
    }
  };

  // 治療法順序を変更
  const moveTreatment = (conditionCode, fromIndex, toIndex) => {
    setTreatmentRules(prev => {
      const treatments = [...(prev[conditionCode] || [])];
      const [moved] = treatments.splice(fromIndex, 1);
      treatments.splice(toIndex, 0, moved);
      
      return {
        ...prev,
        [conditionCode]: treatments
      };
    });
  };

  // 治療法を削除
  const deleteTreatment = (conditionCode, treatmentIndex) => {
    setTreatmentRules(prev => ({
      ...prev,
      [conditionCode]: prev[conditionCode].filter((_, index) => index !== treatmentIndex)
    }));
  };

  // ステップを追加
  const addStep = () => {
    setNewTreatment(prev => ({
      ...prev,
      steps: [...prev.steps, '']
    }));
  };

  // ステップを削除
  const removeStep = (index) => {
    setNewTreatment(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  const getConditionInfo = (code) => {
    return conditions.find(c => c.code === code) || null;
  };

  const getToothDisplayConditions = (toothConditions) => {
    if (!toothConditions || toothConditions.length === 0) return [];
    return toothConditions.map(code => getConditionInfo(code)).filter(Boolean);
  };

  const handleToothClick = (toothNumber) => {
    setSelectedTooth(toothNumber);
  };

  const handleConditionSelect = (conditionCode) => {
    if (bulkConditionMode) {
      // 一括設定モード：選択された歯なしで病名設定
      const newToothNumber = `bulk-${conditionCode}-${Date.now()}`;
      setToothConditions(prev => ({
        ...prev,
        [newToothNumber]: [conditionCode]
      }));
    } else if (selectedTooth) {
      // 通常モード：選択された歯に病名設定
      setToothConditions(prev => {
        const currentConditions = prev[selectedTooth] || [];
        // 既に選択されている場合は削除、そうでなければ追加
        let newConditions;
        if (currentConditions.includes(conditionCode)) {
          newConditions = currentConditions.filter(c => c !== conditionCode);
        } else {
          newConditions = [...currentConditions, conditionCode];
        }
        
        if (newConditions.length === 0) {
          const newState = { ...prev };
          delete newState[selectedTooth];
          return newState;
        }
        
        return {
          ...prev,
          [selectedTooth]: newConditions
        };
      });
    }
  };

  const generateTreatmentNodes = () => {
    const workflowSteps = [];
    
    // 治療の優先順位を考慮（急性症状→感染→う蝕→歯周病の順）
    const priority = ['per', 'pul', 'C4', 'C3', 'P3', 'P2', 'C2', 'P1', 'C1'];
    
    priority.forEach(condition => {
      const affectedTeeth = [];
      Object.entries(toothConditions).forEach(([tooth, conditionsList]) => {
        if (conditionsList.includes(condition)) {
          affectedTeeth.push(tooth);
        }
      });
      
      if (affectedTeeth.length > 0) {
        const treatments = treatmentRules[condition] || [];
        
        // 治療ノードのグループ化方式に応じて処理
        if (treatmentGroupingMode === 'individual') {
          // 個別モード：各歯ごとに治療ノードを作成
          affectedTeeth.forEach(tooth => {
            const treatmentKey = `${condition}-${tooth}`;
            const selectedTreatmentIndex = selectedTreatmentOptions[treatmentKey] || 0;
            const selectedTreatment = treatments[selectedTreatmentIndex] || treatments[0];
            
            if (selectedTreatment) {
              // 複数回の治療は個別のカードに分割
              const cards = [];
              for (let i = 0; i < selectedTreatment.duration; i++) {
                const cardId = `${condition}-${selectedTreatment.name}-${tooth}-${Date.now()}-${Math.random()}-${i}`;
                const stepName = selectedTreatment.steps && selectedTreatment.steps[i] ? selectedTreatment.steps[i] : `${selectedTreatment.name}(${i + 1})`;
                cards.push({
                  id: cardId,
                  baseId: `${condition}-${selectedTreatment.name}-${tooth}`, // グループ識別用
                  condition,
                  treatment: selectedTreatment.name,
                  stepName: stepName, // 各ステップの具体的な名前
                  teeth: [tooth], // 単一歯
                  cardNumber: i + 1,
                  totalCards: selectedTreatment.duration,
                  position: { x: 0, y: workflowSteps.length * 120 },
                  isSequential: selectedTreatment.duration > 1,
                  // 治療選択関連の情報を追加
                  treatmentKey: treatmentKey,
                  availableTreatments: treatments,
                  selectedTreatmentIndex: selectedTreatmentIndex,
                  hasMultipleTreatments: treatments.length > 1
                });
              }
              workflowSteps.push(...cards);
            }
          });
        } else {
          // グループモード：同じ病名の歯をまとめて治療ノードを作成
          const treatmentKey = `${condition}-${affectedTeeth.sort().join(',')}`;
          const selectedTreatmentIndex = selectedTreatmentOptions[treatmentKey] || 0;
          const selectedTreatment = treatments[selectedTreatmentIndex] || treatments[0];
          
          if (selectedTreatment) {
            // 複数回の治療は個別のカードに分割
            const cards = [];
            for (let i = 0; i < selectedTreatment.duration; i++) {
              const cardId = `${condition}-${selectedTreatment.name}-${Date.now()}-${Math.random()}-${i}`;
              const stepName = selectedTreatment.steps && selectedTreatment.steps[i] ? selectedTreatment.steps[i] : `${selectedTreatment.name}(${i + 1})`;
              cards.push({
                id: cardId,
                baseId: `${condition}-${selectedTreatment.name}`, // グループ識別用
                condition,
                treatment: selectedTreatment.name,
                stepName: stepName, // 各ステップの具体的な名前
                teeth: affectedTeeth, // 複数歯
                cardNumber: i + 1,
                totalCards: selectedTreatment.duration,
                position: { x: 0, y: workflowSteps.length * 120 },
                isSequential: selectedTreatment.duration > 1,
                // 治療選択関連の情報を追加
                treatmentKey: treatmentKey,
                availableTreatments: treatments,
                selectedTreatmentIndex: selectedTreatmentIndex,
                hasMultipleTreatments: treatments.length > 1
              });
            }
            workflowSteps.push(...cards);
          }
        }
      }
    });
    
    setWorkflow(workflowSteps);
    
    // 初期スケジュールを生成（空のスケジュール）
    const today = new Date();
    const initialSchedule = [];
    for (let i = 0; i < Math.max(8, Math.ceil(workflowSteps.length / 2)); i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + (i * 7)); // 週1回
      initialSchedule.push({
        date: date.toISOString().split('T')[0],
        treatments: []
      });
    }
    setTreatmentSchedule(initialSchedule);
    
    // 成功メッセージ
    alert(`✅ 治療ノード生成完了！

📊 生成結果:
• 治療ノード: ${workflowSteps.length}件
• 対象歯: ${Object.keys(toothConditions).length}本
• 治療日程: ${initialSchedule.length}回分
• グループ化: ${treatmentGroupingMode === 'individual' ? '個別' : 'まとめ'}

次のステップ:
1. 手動でドラッグ&ドロップ配置、または
2. AIスケジュール生成ボタンで自動配置`);
  };

  // 治療分岐を処理する関数
  const handleTreatmentBranch = (currentStep, newTreatmentIndex) => {
    console.log('=== Treatment Branch Started ===');
    console.log('Current step:', currentStep);
    console.log('New treatment index:', newTreatmentIndex);
    
    const newTreatment = currentStep.availableTreatments[newTreatmentIndex];
    if (!newTreatment) return;
    
    // 現在のステップ以降の同じ治療グループのノードを削除
    const updatedWorkflow = workflow.filter(step => {
      if (step.baseId === currentStep.baseId && step.cardNumber > currentStep.cardNumber) {
        console.log(`Removing future step: ${step.stepName}`);
        return false;
      }
      return true;
    });
    
    // スケジュールからも削除
    const updatedSchedule = treatmentSchedule.map(day => ({
      ...day,
      treatments: day.treatments.filter(treatment => {
        if (treatment.baseId === currentStep.baseId && treatment.cardNumber > currentStep.cardNumber) {
          console.log(`Removing from schedule: ${treatment.stepName}`);
          return false;
        }
        return true;
      })
    }));
    
    // 新しい治療ステップを生成（現在のステップの次から）
    const newSteps = [];
    const remainingSteps = newTreatment.duration - currentStep.cardNumber;
    
    for (let i = 0; i < remainingSteps; i++) {
      const stepIndex = currentStep.cardNumber + i;
      const newStepId = `${currentStep.condition}-${newTreatment.name}-branch-${currentStep.teeth.join(',')}-${Date.now()}-${Math.random()}-${stepIndex}`;
      const stepName = newTreatment.steps && newTreatment.steps[stepIndex] 
        ? newTreatment.steps[stepIndex] 
        : `${newTreatment.name}(${stepIndex + 1})`;
      
      const newStep = {
        id: newStepId,
        baseId: `${currentStep.baseId}-branch-${newTreatmentIndex}`, // 新しいbaseIdで分岐を識別
        condition: currentStep.condition,
        treatment: newTreatment.name,
        stepName: stepName,
        teeth: currentStep.teeth,
        cardNumber: stepIndex + 1,
        totalCards: newTreatment.duration,
        position: { x: 0, y: (updatedWorkflow.length + i) * 120 },
        isSequential: newTreatment.duration > 1,
        treatmentKey: currentStep.treatmentKey,
        availableTreatments: currentStep.availableTreatments,
        selectedTreatmentIndex: newTreatmentIndex,
        hasMultipleTreatments: currentStep.availableTreatments.length > 1,
        isBranched: true, // 分岐したステップであることを示す
        branchedFrom: currentStep.cardNumber // どのステップから分岐したか
      };
      
      newSteps.push(newStep);
    }
    
    console.log('New branched steps:', newSteps);
    
    // ワークフローと治療選択を更新
    setWorkflow([...updatedWorkflow, ...newSteps]);
    setTreatmentSchedule(updatedSchedule);
    
    // 現在のステップの治療選択も更新
    setSelectedTreatmentOptions(prev => ({
      ...prev,
      [currentStep.treatmentKey]: newTreatmentIndex
    }));
    
    // 成功メッセージ
    alert(`🔀 治療分岐完了！

📋 変更内容:
• ${currentStep.cardNumber}回目から「${newTreatment.name}」に変更
• 残り${remainingSteps}ステップを新しい治療法で生成
• 以前の計画は自動的に削除されました

💡 次のステップ:
新しい治療ステップが未スケジュールエリアに追加されました。
ドラッグ&ドロップまたはAIスケジューリングで配置してください。`);
  };

  const generateWorkflow = generateTreatmentNodes; // 後方互換性

  const generateAIWorkflow = async (workflowSteps, initialSchedule) => {
    setIsGeneratingWorkflow(true);
    
    try {
      console.log('=== AI Workflow Generation Started ===');
      console.log('Workflow steps count:', workflowSteps.length);
      console.log('Initial schedule count:', initialSchedule.length);
      console.log('Tooth conditions:', toothConditions);

      // 患者の状態を整理
      const patientConditions = Object.entries(toothConditions).map(([tooth, conditions]) => {
        const isBulkEntry = tooth.startsWith('bulk-');
        return {
          tooth: isBulkEntry ? '全般' : tooth,
          conditions: conditions.map(code => {
            const conditionInfo = getConditionInfo(code);
            return conditionInfo ? conditionInfo.name : code;
          })
        };
      });

      console.log('Patient conditions:', patientConditions);

      // 患者データチェック
      if (patientConditions.length === 0) {
        alert('❌ 患者の歯科状態が設定されていません。\n\n1. 歯式図で歯をクリック、または\n2. 「歯番号なし病名追加」で病名設定\n3. 再度生成ボタンを押してください');
        return;
      }

      // 治療ステップチェック
      if (workflowSteps.length === 0) {
        alert('❌ 治療ステップが生成されていません。\n\n先に「治療ノード生成」ボタンを押してください。');
        return;
      }

      // 利用可能な治療ステップを整理
      const treatmentList = workflowSteps.map((step, index) => 
        `${index + 1}. ID:"${step.id}" | ${step.stepName} | 歯:${step.teeth.join(',')} | 病名:${step.condition}${step.isSequential ? ` | 連続治療${step.cardNumber}/${step.totalCards}回目` : ' | 単回治療'}`
      ).join('\n');

      console.log('Treatment list for AI:', treatmentList);

      // 詳細なプロンプトを作成
      const prompt = `あなたは経験豊富な歯科医師として、患者の治療スケジュールを最適化してください。

## 患者の口腔内状況
${patientConditions.map(p => `• ${p.tooth}: ${p.conditions.join('、')}`).join('\n')}

## 利用可能な治療項目
${treatmentList}

## 治療予定日
${initialSchedule.map((day, i) => `${i + 1}回目: ${day.date} (${new Date(day.date).toLocaleDateString('ja-JP', { weekday: 'short' })})`).join('\n')}

## 治療方針・制約
${aiPrompt}

## スケジューリング原則
1. **急性症状優先**: per（根尖性歯周炎）、pul（歯髄炎）、C4（残根）を最優先
2. **連続治療管理**: 複数回の治療は必ず順序通りに配置
3. **治療間隔**: 根管治療は週1回、補綴治療は2週間隔を基本とする
4. **患者負担軽減**: 1日の治療数は最大3項目まで
5. **痛み管理**: 痛みを伴う治療から優先的に実施

## 回答形式
以下のJSON形式で厳密に回答してください（他の文字は一切含めない）:

{
  "schedule": [
    {"date": "2025-07-23", "treatmentIds": ["実際の治療ID1", "実際の治療ID2"]},
    {"date": "2025-07-30", "treatmentIds": ["実際の治療ID3"]}
  ],
  "reasoning": "スケジューリングの判断理由と臨床的根拠",
  "priorities": "優先度の考え方",
  "riskAssessment": "治療計画のリスク評価"
}

注意：treatmentIds は上記治療項目リストのIDを完全一致で使用してください。`;

      console.log('=== Sending prompt to Claude API ===');
      console.log(prompt);

      // Claude API呼び出し
      let rawResponse;
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 3000,
            temperature: 0.3, // 医療的判断なので低めの温度設定
            messages: [
              { 
                role: "user", 
                content: prompt 
              }
            ]
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        rawResponse = data.content[0].text;
        console.log('=== Raw Claude Response ===');
        console.log(rawResponse);
      } catch (apiError) {
        console.error('Claude API Error:', apiError);
        
        // API失敗時はフォールバック処理
        console.log('API failed, falling back to rule-based scheduling...');
        return fallbackScheduling(workflowSteps, initialSchedule);
      }

      if (!rawResponse || rawResponse.trim() === '') {
        throw new Error('Claude APIから空のレスポンスが返されました');
      }

      // JSON抽出（複数の方法を試行）
      let jsonResponse;
      
      try {
        // 方法1: 直接パース
        jsonResponse = JSON.parse(rawResponse.trim());
        console.log('✅ Direct JSON parse successful');
      } catch (e1) {
        try {
          // 方法2: マークダウンコードブロック除去
          let cleaned = rawResponse
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();
          jsonResponse = JSON.parse(cleaned);
          console.log('✅ Markdown cleanup successful');
        } catch (e2) {
          try {
            // 方法3: 正規表現でJSON抽出
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              jsonResponse = JSON.parse(jsonMatch[0]);
              console.log('✅ Regex extraction successful');
            } else {
              throw new Error('JSONパターンが見つかりません');
            }
          } catch (e3) {
            console.error('All JSON parsing methods failed');
            console.error('Raw response:', rawResponse);
            
            // パース失敗時はフォールバック処理
            return fallbackScheduling(workflowSteps, initialSchedule);
          }
        }
      }

      console.log('=== Parsed AI Response ===');
      console.log(jsonResponse);

      // レスポンス検証
      if (!jsonResponse || typeof jsonResponse !== 'object') {
        throw new Error('有効なJSONオブジェクトではありません');
      }

      if (!jsonResponse.schedule || !Array.isArray(jsonResponse.schedule)) {
        throw new Error('schedule配列が見つかりません');
      }

      // 新しいスケジュール作成
      const newSchedule = initialSchedule.map(day => ({
        ...day,
        treatments: []
      }));

      let totalAssigned = 0;
      let assignmentDetails = [];
      let errors = [];

      // AI提案のスケジュールを適用
      jsonResponse.schedule.forEach((aiDay, aiIndex) => {
        console.log(`Processing AI day ${aiIndex}:`, aiDay);
        
        if (!aiDay.date || !aiDay.treatmentIds || !Array.isArray(aiDay.treatmentIds)) {
          console.log(`Skipping invalid AI day ${aiIndex}`);
          errors.push(`❌ 無効な日程データ: ${JSON.stringify(aiDay)}`);
          return;
        }

        // 対応する日を見つける
        const scheduleIndex = newSchedule.findIndex(day => 
          day.date === aiDay.date || 
          new Date(day.date).toISOString().split('T')[0] === new Date(aiDay.date).toISOString().split('T')[0]
        );
        
        console.log(`Date ${aiDay.date} found at index:`, scheduleIndex);

        if (scheduleIndex === -1) {
          console.log(`Date ${aiDay.date} not found in schedule`);
          errors.push(`❌ 治療日 ${aiDay.date} がスケジュールにありません`);
          return;
        }

        // 治療IDをマッチング
        const matchedTreatments = [];
        aiDay.treatmentIds.forEach(treatmentId => {
          const cleanId = treatmentId.trim();
          const treatment = workflowSteps.find(step => step.id === cleanId);
          if (treatment) {
            matchedTreatments.push(treatment);
            totalAssigned++;
            assignmentDetails.push(`✅ ${treatment.stepName} (歯${treatment.teeth.join(',')}) → ${aiDay.date}`);
            console.log(`✅ Matched treatment ${cleanId}: ${treatment.stepName}`);
          } else {
            console.log(`❌ Treatment ID not found: "${cleanId}"`);
            errors.push(`❌ 治療ID "${cleanId}" が見つかりません`);
          }
        });

        newSchedule[scheduleIndex].treatments = matchedTreatments;
      });

      console.log('=== Final Schedule Update ===');
      console.log('Total treatments assigned:', totalAssigned);
      console.log('Errors:', errors);

      // 状態更新
      setTreatmentSchedule(newSchedule);

      // 詳細な結果通知
      const successMsg = `🤖 AI治療スケジュール生成完了！

📊 結果サマリー:
• 配置された治療: ${totalAssigned}件 / ${workflowSteps.length}件中
• 対象歯: ${Object.keys(toothConditions).length}本
• 治療期間: ${newSchedule.filter(day => day.treatments.length > 0).length}回

${errors.length > 0 ? `⚠️ 警告:\n${errors.slice(0, 3).join('\n')}\n` : ''}

🧠 AIの判断理由:
${jsonResponse.reasoning || 'スケジュール最適化を実行しました'}

🎯 優先度の考え方:
${jsonResponse.priorities || '急性症状から順次治療'}

⚕️ リスク評価:
${jsonResponse.riskAssessment || '標準的な治療計画です'}

📋 配置詳細:
${assignmentDetails.slice(0, 8).join('\n')}
${assignmentDetails.length > 8 ? `\n...他${assignmentDetails.length - 8}件` : ''}

治療スケジュール欄をご確認ください！`;

      alert(successMsg);

    } catch (error) {
      console.error('=== AI Generation Error ===');
      console.error('Error:', error);
      console.error('Stack:', error.stack);

      // エラー時はフォールバック処理
      console.log('Error occurred, falling back to rule-based scheduling...');
      return fallbackScheduling(workflowSteps, initialSchedule);
    } finally {
      setIsGeneratingWorkflow(false);
    }
  };

  // フォールバック用のルールベーススケジューリング
  const fallbackScheduling = (workflowSteps, initialSchedule) => {
    console.log('=== Fallback Scheduling Started ===');
    
    const newSchedule = initialSchedule.map(day => ({
      ...day,
      treatments: []
    }));

    // 治療の優先順位
    const priorityOrder = ['per', 'pul', 'C4', 'C3', 'C2', 'P2', 'P1', 'C1'];
    
    const sortedTreatments = [...workflowSteps].sort((a, b) => {
      const aPriority = priorityOrder.indexOf(a.condition);
      const bPriority = priorityOrder.indexOf(b.condition);
      
      if (aPriority !== bPriority) {
        return (aPriority === -1 ? 999 : aPriority) - (bPriority === -1 ? 999 : bPriority);
      }
      
      if (a.baseId === b.baseId) {
        return a.cardNumber - b.cardNumber;
      }
      
      return 0;
    });

    let currentDayIndex = 0;
    let totalAssigned = 0;

    sortedTreatments.forEach(treatment => {
      while (currentDayIndex < newSchedule.length) {
        const currentDay = newSchedule[currentDayIndex];
        
        if (currentDay.treatments.length < 3) {
          // 連続治療の制約チェック
          if (treatment.isSequential && treatment.cardNumber > 1) {
            const previousCardNumber = treatment.cardNumber - 1;
            const previousCard = workflowSteps.find(w => 
              w.baseId === treatment.baseId && 
              w.cardNumber === previousCardNumber
            );
            
            if (previousCard) {
              let foundPrevious = false;
              for (let i = 0; i < currentDayIndex; i++) {
                if (newSchedule[i].treatments.some(t => t.id === previousCard.id)) {
                  foundPrevious = true;
                  break;
                }
              }
              if (!foundPrevious) {
                currentDayIndex++;
                continue;
              }
            }
          }
          
          currentDay.treatments.push(treatment);
          totalAssigned++;
          
          if (['per', 'pul', 'C4'].includes(treatment.condition)) {
            currentDayIndex++;
          }
          
          break;
        } else {
          currentDayIndex++;
        }
      }
      
      if (currentDayIndex >= newSchedule.length) {
        const lastDate = newSchedule.length > 0 
          ? new Date(newSchedule[newSchedule.length - 1].date)
          : new Date();
        
        const newDate = new Date(lastDate);
        newDate.setDate(lastDate.getDate() + 7);
        
        newSchedule.push({
          date: newDate.toISOString().split('T')[0],
          treatments: [treatment]
        });
        
        totalAssigned++;
      }
    });

    setTreatmentSchedule(newSchedule);

    const fallbackMsg = `⚡ フォールバック・スケジューリング完了

📊 結果:
• 配置された治療: ${totalAssigned}件 / ${workflowSteps.length}件中
• ルールベース処理により安全に配置しました

🔄 APIエラーのため、基本ルールでスケジュールを生成しました。
より高度なAI分析が必要な場合は、再度お試しください。`;

    alert(fallbackMsg);
  };

  const executeAIScheduling = async () => {
    // 治療ノードが存在するかチェック
    if (workflow.length === 0) {
      alert('❌ 治療ノードが生成されていません。\n\n先に「治療ノード生成」ボタンを押してください。');
      return;
    }

    // 治療スケジュールが存在するかチェック
    if (treatmentSchedule.length === 0) {
      alert('❌ 治療スケジュールが生成されていません。\n\n先に「治療ノード生成」ボタンを押してください。');
      return;
    }

    await generateAIWorkflow(workflow, treatmentSchedule);
  };

  const canDropCard = (card, targetDate) => {
    if (!card.isSequential) return true; // 単回治療は制約なし
    
    // 同じ治療の前のカードがあるかチェック
    if (card.cardNumber === 1) return true; // 最初のカードは制約なし
    
    const previousCardNumber = card.cardNumber - 1;
    const previousCard = workflow.find(w => 
      w.baseId === card.baseId && 
      w.cardNumber === previousCardNumber
    );
    
    if (!previousCard) return true;
    
    // 前のカードの配置日を確認
    let previousCardDate = null;
    for (const day of treatmentSchedule) {
      if (day.treatments.some(t => t.id === previousCard.id)) {
        previousCardDate = day.date;
        break;
      }
    }
    
    if (!previousCardDate) return false; // 前のカードが未配置
    
    // 前のカードより後の日付かチェック
    return new Date(targetDate) > new Date(previousCardDate);
  };

  const canMoveCard = (card, targetDate) => {
    if (!card.isSequential) return true;
    
    // 現在のカードより後のカードがスケジュールに配置されているかチェック
    const laterCards = workflow.filter(w => 
      w.baseId === card.baseId && 
      w.cardNumber > card.cardNumber
    );
    
    for (const laterCard of laterCards) {
      for (const day of treatmentSchedule) {
        if (day.treatments.some(t => t.id === laterCard.id)) {
          // 後のカードの日付より前でないといけない
          if (new Date(targetDate) >= new Date(day.date)) {
            return false;
          }
        }
      }
    }
    
    return canDropCard(card, targetDate);
  };

  const isCardAvailableForDrag = (card) => {
    if (!card.isSequential) return true; // 単回治療は制約なし
    if (card.cardNumber === 1) return true; // 最初のカードは制約なし
    
    // 前のカードが配置されているかチェック
    const previousCardNumber = card.cardNumber - 1;
    const previousCard = workflow.find(w => 
      w.baseId === card.baseId && 
      w.cardNumber === previousCardNumber
    );
    
    if (!previousCard) return false;
    
    // 前のカードがスケジュールに配置されているかチェック
    return treatmentSchedule.some(day => 
      day.treatments.some(t => t.id === previousCard.id)
    );
  };

  const handleDragStart = (e, node) => {
    console.log('Drag started:', node);
    setDraggedNode(node);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ''); // Firefoxで必要
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetDate) => {
    e.preventDefault();
    console.log('Drop:', draggedNode, 'to', targetDate);
    
    if (!draggedNode) return;
    
    // ドロップ可能かチェック（前後の治療順序を考慮）
    if (!canMoveCard(draggedNode, targetDate)) {
      alert('治療の順序が正しくありません。前の治療の後、次の治療の前に配置してください。');
      setDraggedNode(null);
      return;
    }

    // 既存のスケジュールから該当ノードを削除
    const updatedSchedule = treatmentSchedule.map(day => ({
      ...day,
      treatments: day.treatments.filter(t => t.id !== draggedNode.id)
    }));

    // 新しい日付に追加
    const targetDayIndex = updatedSchedule.findIndex(day => day.date === targetDate);
    if (targetDayIndex !== -1) {
      updatedSchedule[targetDayIndex].treatments.push(draggedNode);
    }

    // 自動スケジューリングが有効で、かつ複数ステップの最初のカードの場合
    if (autoScheduleEnabled && draggedNode.isSequential && draggedNode.cardNumber === 1) {
      autoScheduleRemainingSteps(draggedNode, targetDayIndex, updatedSchedule);
    }

    setTreatmentSchedule(updatedSchedule);
    setDraggedNode(null);
  };

  // 残りのステップを自動スケジューリング
  const autoScheduleRemainingSteps = (firstCard, startDayIndex, schedule) => {
    // 同じ治療グループの残りのカードを取得
    const remainingCards = workflow.filter(w => 
      w.baseId === firstCard.baseId && 
      w.cardNumber > firstCard.cardNumber
    ).sort((a, b) => a.cardNumber - b.cardNumber);

    let currentDayIndex = startDayIndex;
    
    remainingCards.forEach(card => {
      // 次の治療日を探す（週1回ペース）
      currentDayIndex += 1;
      
      // 必要に応じて新しい治療日を追加
      while (currentDayIndex >= schedule.length) {
        const lastDate = schedule.length > 0 
          ? new Date(schedule[schedule.length - 1].date)
          : new Date();
        
        const newDate = new Date(lastDate);
        newDate.setDate(lastDate.getDate() + 7);
        
        schedule.push({
          date: newDate.toISOString().split('T')[0],
          treatments: []
        });
      }
      
      // カードを配置
      schedule[currentDayIndex].treatments.push(card);
    });
  };

  const addNewTreatmentDay = () => {
    const lastDate = treatmentSchedule.length > 0 
      ? new Date(treatmentSchedule[treatmentSchedule.length - 1].date)
      : new Date();
    
    const newDate = new Date(lastDate);
    newDate.setDate(lastDate.getDate() + 7);
    
    setTreatmentSchedule([...treatmentSchedule, {
      date: newDate.toISOString().split('T')[0],
      treatments: []
    }]);
  };

  const changeTreatmentOption = (treatmentKey, newTreatmentIndex) => {
    // 選択された治療を更新
    setSelectedTreatmentOptions(prev => ({
      ...prev,
      [treatmentKey]: newTreatmentIndex
    }));
    
    // 治療ノードを再生成
    generateTreatmentNodes();
  };

  const renderDraggableNode = (step, isInSchedule = false, onRemoveFromSchedule = null) => {
    // ドラッグ可能かチェック
    const canDrag = isCardAvailableForDrag(step);
    const isDisabled = !canDrag && !isInSchedule;
    
    return (
      <div
        key={step.id}
        draggable={canDrag}
        onDragStart={(e) => canDrag && handleDragStart(e, step)}
        className={`bg-white border-2 rounded-lg p-3 shadow-sm transition-all select-none relative ${
          isDisabled 
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60' 
            : 'border-gray-300 cursor-move hover:shadow-md'
        } ${step.isBranched ? 'border-orange-300 bg-orange-50' : ''}`}
        style={{ userSelect: 'none' }}
      >
        {/* 分岐表示バッジ */}
        {step.isBranched && (
          <div className="absolute top-1 left-1 bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
            分岐
          </div>
        )}
        
        {/* スケジュールから削除ボタン */}
        {isInSchedule && onRemoveFromSchedule && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemoveFromSchedule(step);
            }}
            className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors flex items-center justify-center"
            title="スケジュールから削除"
          >
            ×
          </button>
        )}
        
        <div className="flex items-center gap-2 mb-2">
          <GripVertical className={`w-4 h-4 flex-shrink-0 ${isDisabled ? 'text-gray-300' : 'text-gray-400'}`} />
          <h3 className="font-bold text-sm flex-1 pr-6">{step.stepName}</h3>
          {step.isSequential && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              {step.cardNumber}/{step.totalCards}
            </span>
          )}
        </div>
        
        {/* 治療選択ボタン（複数治療がある場合） */}
        {step.hasMultipleTreatments && (
          <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded">
            <div className="text-xs text-blue-800 font-medium mb-2 text-center">
              治療法選択 ({step.selectedTreatmentIndex + 1}/{step.availableTreatments.length})
              {step.cardNumber > 1 && (
                <span className="ml-2 bg-orange-200 text-orange-800 px-2 py-1 rounded-full">
                  分岐可能
                </span>
              )}
            </div>
            <div className="flex items-center justify-center gap-2">
              {/* 前の治療法ボタン */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const currentIndex = step.selectedTreatmentIndex;
                  const newIndex = currentIndex > 0 ? currentIndex - 1 : step.availableTreatments.length - 1;
                  
                  // 分岐処理か通常の変更かを判定
                  if (step.cardNumber === 1) {
                    changeTreatmentOption(step.treatmentKey, newIndex);
                  } else {
                    handleTreatmentBranch(step, newIndex);
                  }
                }}
                className="w-6 h-6 bg-blue-500 text-white rounded-full text-xs hover:bg-blue-600 transition-colors flex items-center justify-center font-bold"
                title={step.cardNumber === 1 ? "前の治療法" : "前の治療法に分岐"}
              >
                ‹
              </button>
              
              {/* 現在の治療法表示 */}
              <div className="flex-1 text-center px-2">
                <div className="text-xs font-medium text-blue-900">
                  {step.availableTreatments[step.selectedTreatmentIndex]?.name || step.treatment}
                </div>
                <div className="text-xs text-blue-600">
                  ({step.availableTreatments[step.selectedTreatmentIndex]?.duration || 1}回)
                </div>
                {step.cardNumber > 1 && (
                  <div className="text-xs text-orange-600 mt-1">
                    この回から変更可能
                  </div>
                )}
              </div>
              
              {/* 次の治療法ボタン */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const currentIndex = step.selectedTreatmentIndex;
                  const newIndex = currentIndex < step.availableTreatments.length - 1 ? currentIndex + 1 : 0;
                  
                  // 分岐処理か通常の変更かを判定
                  if (step.cardNumber === 1) {
                    changeTreatmentOption(step.treatmentKey, newIndex);
                  } else {
                    handleTreatmentBranch(step, newIndex);
                  }
                }}
                className="w-6 h-6 bg-blue-500 text-white rounded-full text-xs hover:bg-blue-600 transition-colors flex items-center justify-center font-bold"
                title={step.cardNumber === 1 ? "次の治療法" : "次の治療法に分岐"}
              >
                ›
              </button>
            </div>
            
            {/* 治療法リスト表示（小さく） */}
            <div className="mt-2 text-xs text-blue-600">
              選択可能: {step.availableTreatments.map((t, i) => 
                `${i + 1}.${t.name}(${t.duration}回)`
              ).join(', ')}
            </div>
            
            {/* 分岐の説明 */}
            {step.cardNumber > 1 && (
              <div className="mt-2 p-2 bg-orange-100 border border-orange-300 rounded text-xs">
                <div className="font-medium text-orange-800 mb-1">🔀 治療分岐について</div>
                <div className="text-orange-700">
                  この回から治療法を変更すると、以降のステップが新しい治療法で再生成されます。
                  既存のスケジュールは自動的に調整されます。
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="text-xs text-gray-700 mb-1">
          対象歯: {step.teeth.join(', ')}
        </div>
        <div className="text-xs text-blue-600 mb-2">
          病名: {step.condition}
          {step.isBranched && (
            <span className="ml-2 text-orange-600">
              (第{step.branchedFrom}回から分岐)
            </span>
          )}
        </div>
        
        {isDisabled && (
          <div className="text-xs text-red-500 mt-2">
            前の治療を先に配置してください
          </div>
        )}
      </div>
    );
  };

  const renderStackedTreatmentCard = (cardGroup, activeCard) => {
    const totalCards = cardGroup.length;
    const activeIndex = cardGroup.findIndex(card => card.id === activeCard.id);
    
    return (
      <div className="relative">
        {/* 背景カードの表示（重なり効果） */}
        {Array.from({length: Math.min(3, totalCards)}, (_, i) => {
          const offset = (totalCards - 1 - i) * 2;
          return (
            <div
              key={`bg-${i}`}
              className="absolute bg-gray-200 border border-gray-400 rounded-lg"
              style={{
                top: `-${offset}px`,
                right: `-${offset}px`,
                left: `${offset}px`,
                bottom: `${offset}px`,
                zIndex: i
              }}
            />
          );
        })}
        
        {/* アクティブカード */}
        <div className="relative" style={{zIndex: 10}}>
          {renderDraggableNode(activeCard, false, null)}
        </div>
        
        {/* 進捗表示 */}
        <div className="text-center mt-2">
          <div className="text-xs text-gray-500">
            {activeIndex + 1} / {totalCards} 枚目
          </div>
          <div className="flex justify-center mt-1">
            {cardGroup.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full mx-1 ${
                  index <= activeIndex ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderUnassignedTreatments = () => {
    const assignedIds = new Set();
    treatmentSchedule.forEach(day => {
      day.treatments.forEach(treatment => assignedIds.add(treatment.id));
    });
    
    const unassigned = workflow.filter(step => !assignedIds.has(step.id));
    
    if (unassigned.length === 0) return null;
    
    // 治療グループごとにまとめて表示（スタック形式）
    const groupedTreatments = {};
    unassigned.forEach(step => {
      if (!groupedTreatments[step.baseId]) {
        groupedTreatments[step.baseId] = [];
      }
      groupedTreatments[step.baseId].push(step);
    });
    
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">未スケジュール治療</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(groupedTreatments).map(group => {
            // カード番号順にソート
            const sortedGroup = group.sort((a, b) => a.cardNumber - b.cardNumber);
            // 現在表示すべきカード（ドラッグ可能な最初のカード）を取得
            const availableCard = sortedGroup.find(card => isCardAvailableForDrag(card)) || sortedGroup[0];
            
            return (
              <div key={availableCard.baseId} className="relative">
                {renderStackedTreatmentCard(sortedGroup, availableCard)}
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-sm text-gray-600">
          💡 重ねたカードは治療完了後に次のカードが表示されます
        </div>
      </div>
    );
  };

  const renderTreatmentSchedule = () => {
    // スケジュールからアイテムを削除する関数
    const removeFromSchedule = (treatmentToRemove) => {
      const updatedSchedule = treatmentSchedule.map(day => ({
        ...day,
        treatments: day.treatments.filter(t => t.id !== treatmentToRemove.id)
      }));
      setTreatmentSchedule(updatedSchedule);
    };

    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">治療スケジュール</h2>
          <button
            onClick={addNewTreatmentDay}
            className="flex items-center gap-2 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            治療日追加
          </button>
        </div>
        
        <div className="space-y-4">
          {treatmentSchedule.map((day, index) => (
            <div
              key={day.date}
              className="border rounded-lg p-4 bg-gray-50"
            >
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-blue-500" />
                <h3 className="font-bold">
                  第{index + 1}回目 - {new Date(day.date).toLocaleDateString('ja-JP', { 
                    year: 'numeric',
                    month: 'short', 
                    day: 'numeric',
                    weekday: 'short'
                  })}
                </h3>
                {day.treatments.length > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full ml-2">
                    {day.treatments.length}件
                  </span>
                )}
              </div>
              
              <div 
                className="min-h-[120px] border-2 border-dashed border-gray-300 rounded-lg p-3 bg-white"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day.date)}
              >
                {day.treatments.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {day.treatments.map(treatment => 
                      renderDraggableNode(treatment, true, removeFromSchedule)
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
                    治療ノードをドラッグしてください
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 text-sm text-gray-600">
          💡 治療ノードをドラッグして任意の治療日に配置できます
          {autoScheduleEnabled && (
            <span className="block mt-1 text-blue-600">
              🔄 自動スケジューリング有効：複数ステップ治療の1回目を配置すると残りが自動配置されます
            </span>
          )}
          <span className="block mt-1 text-purple-600">
            🤖 AIスケジュール生成：治療ノード生成後、設定したプロンプトに基づいて最適配置
          </span>
          <span className="block mt-1 text-red-600">
            ❌ スケジュール削除：各治療ノードの右上の×ボタンで未スケジュールに戻せます
          </span>
        </div>
      </div>
    );
  };

  const renderTooth = (toothNumber) => {
    const toothConditionsList = toothConditions[toothNumber] || [];
    const conditionInfos = getToothDisplayConditions(toothConditionsList);
    const isSelected = selectedTooth === toothNumber;
    
    // 複数の病名がある場合の表示処理
    const primaryCondition = conditionInfos[0];
    
    return (
      <div
        key={toothNumber}
        className={`w-12 h-16 border-2 rounded-sm cursor-pointer flex flex-col items-center justify-between text-xs font-bold transition-all relative
          ${isSelected ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-300' : 'border-gray-300 hover:border-gray-400'}
          ${primaryCondition ? primaryCondition.color : 'bg-white hover:bg-gray-50'}
        `}
        onClick={() => handleToothClick(toothNumber)}
        title={conditionInfos.length > 0 ? 
          `${toothNumber}: ${conditionInfos.map(c => c.name).join(', ')}` : 
          `歯番 ${toothNumber}`
        }
      >
        {/* 歯番表示 */}
        <div className="text-[9px] leading-tight mt-1">
          {toothConditionsList.includes('Br支台') ? (
            <span className="relative">
              <span className="absolute inset-0 border border-current rounded-full"></span>
              <span className="px-1">{toothNumber}</span>
            </span>
          ) : (
            toothNumber
          )}
        </div>
        
        {/* 病名表示エリア */}
        <div className="flex-1 flex flex-col items-center justify-center w-full px-1">
          {conditionInfos.length > 0 ? (
            <div className="text-center">
              {conditionInfos.slice(0, 2).map((info, index) => (
                <div key={info.code} className="text-[8px] font-black leading-tight">
                  {info.symbol}
                </div>
              ))}
              {conditionInfos.length > 2 && (
                <div className="text-[7px] text-gray-600">+{conditionInfos.length - 2}</div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">歯科治療ワークフロー生成</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Settings className="w-4 h-4" />
                設定
              </button>
              <button
                onClick={generateTreatmentNodes}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Play className="w-4 h-4" />
                治療ノード生成
              </button>
              <button
                onClick={executeAIScheduling}
                disabled={isGeneratingWorkflow || workflow.length === 0}
                className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors ${
                  isGeneratingWorkflow || workflow.length === 0
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-purple-500 hover:bg-purple-600'
                }`}
              >
                <span className="text-lg">🤖</span>
                {isGeneratingWorkflow ? 'AI配置中...' : 'AIスケジュール生成'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* 左側: 歯式入力 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">歯式入力</h2>
            
            {/* 治療ノードグループ化設定 */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-blue-900">治療ノード設定</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    複数歯の同じ病名
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="groupingMode"
                        value="individual"
                        checked={treatmentGroupingMode === 'individual'}
                        onChange={(e) => setTreatmentGroupingMode(e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm">個別ノード（歯ごとに分離）</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="groupingMode"
                        value="grouped"
                        checked={treatmentGroupingMode === 'grouped'}
                        onChange={(e) => setTreatmentGroupingMode(e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm">まとめノード（同じ治療をまとめる）</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    病名設定モード
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={bulkConditionMode}
                        onChange={(e) => setBulkConditionMode(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm">歯を選択せずに病名追加</span>
                    </label>
                    {bulkConditionMode && (
                      <div className="text-xs text-blue-600 pl-6">
                        病名ボタンをクリックすると歯番号なしで追加されます
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* 歯式図 */}
            <div className="mb-6">
              <div className="text-center mb-2 text-sm text-gray-600">上顎</div>
              <div className="flex justify-center gap-1 mb-4">
                {teethNumbers[0].map(renderTooth)}
              </div>
              <div className="text-center mb-2 text-sm text-gray-600">下顎</div>
              <div className="flex justify-center gap-1">
                {teethNumbers[1].map(renderTooth)}
              </div>
            </div>

            {/* 病名選択 */}
            {(selectedTooth || bulkConditionMode) && (
              <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                <h3 className="font-bold mb-2">
                  {bulkConditionMode 
                    ? '病名を追加（歯番号なし）' 
                    : `歯番 ${selectedTooth} の病名を選択`
                  }
                </h3>
                <div className="text-xs text-gray-600 mb-3">
                  {bulkConditionMode 
                    ? '選択した病名が一般的な病名として追加されます'
                    : '複数選択可能（クリックで選択/解除）'
                  }
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {conditions.map(condition => {
                    const isSelected = bulkConditionMode 
                      ? false 
                      : (toothConditions[selectedTooth] || []).includes(condition.code);
                    return (
                      <button
                        key={condition.code}
                        onClick={() => handleConditionSelect(condition.code)}
                        className={`px-3 py-2 border rounded transition-all flex items-center justify-between ${
                          isSelected 
                            ? `${condition.color} ring-2 ring-blue-400` 
                            : 'bg-white border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-sm">{condition.name}</span>
                        <span className="font-black text-lg">{condition.symbol}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-3">
                  {!bulkConditionMode && (
                    <button
                      onClick={() => {
                        const newConditions = { ...toothConditions };
                        delete newConditions[selectedTooth];
                        setToothConditions(newConditions);
                      }}
                      className="flex-1 px-3 py-2 bg-gray-200 border border-gray-400 rounded hover:bg-gray-300 transition-colors"
                    >
                      全てクリア
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedTooth(null);
                      setBulkConditionMode(false);
                    }}
                    className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    完了
                  </button>
                </div>
              </div>
            )}

            {/* 設定中の病名一覧 */}
            {Object.keys(toothConditions).length > 0 && (
              <div className="mt-4">
                <h3 className="font-bold mb-2">設定済み病名</h3>
                <div className="space-y-2">
                  {Object.entries(toothConditions).map(([tooth, conditionsList]) => {
                    const conditionInfos = getToothDisplayConditions(conditionsList);
                    const isBulkEntry = tooth.startsWith('bulk-');
                    const displayTooth = isBulkEntry ? '全般' : `歯番 ${tooth}`;
                    
                    return (
                      <div key={tooth} className={`p-3 rounded border ${isBulkEntry ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50'}`}>
                        <div className="flex justify-between items-start">
                          <span className="font-medium">
                            {displayTooth}
                            {isBulkEntry && (
                              <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">
                                歯番号なし
                              </span>
                            )}
                          </span>
                          <div className="flex gap-2">
                            {!isBulkEntry && (
                              <button
                                onClick={() => setSelectedTooth(tooth)}
                                className="text-xs text-blue-600 hover:text-blue-800"
                              >
                                編集
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const newConditions = { ...toothConditions };
                                delete newConditions[tooth];
                                setToothConditions(newConditions);
                              }}
                              className="text-xs text-red-600 hover:text-red-800"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {conditionInfos.map((info, index) => (
                            <span
                              key={info.code}
                              className={`text-xs px-2 py-1 rounded-full ${info.color.replace('bg-', 'bg-').replace('border-', 'border-').replace('text-', 'text-')}`}
                            >
                              {info.symbol} {info.name.split('（')[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* クイックアクション */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setBulkConditionMode(true)}
                    className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-xs hover:bg-yellow-200 transition-colors"
                  >
                    + 歯番号なしで病名追加
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 未スケジュール治療一覧 */}
          {workflow.length > 0 && renderUnassignedTreatments()}

          {/* 治療スケジュール */}
          {treatmentSchedule.length > 0 && renderTreatmentSchedule()}
        </div>

        {/* 設定パネル */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">病名・治療法設定</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                  title="設定を閉じる"
                >
                  ×
                </button>
              </div>

              {/* AIワークフロー生成設定 */}
              <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                <h3 className="text-lg font-bold text-purple-900 mb-3 flex items-center gap-2">
                  🤖 AI治療スケジューリング
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-purple-800 mb-2">
                      治療方針・制約プロンプト
                    </label>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="例：患者の痛みを最優先に、急性症状から治療してください。根管治療は週1回ペース、補綴物は2週間隔で進めてください。"
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-purple-700">
                    <div>
                      <div className="font-medium mb-1">💡 使用例</div>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>「痛みのある歯を最優先で治療」</li>
                        <li>「右側から先に治療して左側で噛めるように」</li>
                        <li>「根管治療は週1回、印象は2週間間隔で」</li>
                      </ul>
                    </div>
                    <div>
                      <div className="font-medium mb-1">🔧 動作確認</div>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>歯式入力完了後に生成ボタンを押す</li>
                        <li>ブラウザのコンソールでログ確認可能</li>
                        <li>エラー時は詳細情報を表示</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* 自動スケジューリング設定 */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-blue-900 mb-1">自動スケジューリング</h3>
                    <p className="text-sm text-blue-700">
                      複数ステップ治療の1回目を配置時に、残りのステップを自動的に後日に配置します
                    </p>
                  </div>
                  <div className="flex items-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoScheduleEnabled}
                        onChange={(e) => setAutoScheduleEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-3 text-sm font-medium text-blue-900">
                        {autoScheduleEnabled ? 'ON' : 'OFF'}
                      </span>
                    </label>
                  </div>
                </div>
                {autoScheduleEnabled && (
                  <div className="mt-2 text-xs text-blue-600">
                    💡 例：インレーの「印象採得」を第1回目に配置すると、「セット」が自動的に第2回目に配置されます
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 病名設定 */}
                <div>
                  <h3 className="text-lg font-bold mb-3">病名マスター</h3>
                  
                  {/* 新しい病名追加 */}
                  <div className="border rounded-lg p-4 mb-4 bg-gray-50">
                    <h4 className="font-medium mb-2">新しい病名を追加</h4>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="病名コード（例：C1）"
                        value={newCondition.code}
                        onChange={(e) => setNewCondition(prev => ({ ...prev, code: e.target.value }))}
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                      <input
                        type="text"
                        placeholder="病名（例：C1（初期う蝕））"
                        value={newCondition.name}
                        onChange={(e) => setNewCondition(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                      <input
                        type="text"
                        placeholder="表示記号（例：C1）"
                        value={newCondition.symbol}
                        onChange={(e) => setNewCondition(prev => ({ ...prev, symbol: e.target.value }))}
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                      <select
                        value={newCondition.color}
                        onChange={(e) => setNewCondition(prev => ({ ...prev, color: e.target.value }))}
                        className="w-full px-3 py-2 border rounded text-sm"
                      >
                        <option value="bg-yellow-100 border-yellow-400 text-yellow-800">黄色</option>
                        <option value="bg-orange-100 border-orange-400 text-orange-800">オレンジ</option>
                        <option value="bg-red-100 border-red-400 text-red-800">赤</option>
                        <option value="bg-pink-100 border-pink-400 text-pink-800">ピンク</option>
                        <option value="bg-purple-100 border-purple-400 text-purple-800">紫</option>
                        <option value="bg-blue-100 border-blue-400 text-blue-800">青</option>
                        <option value="bg-green-100 border-green-400 text-green-800">緑</option>
                        <option value="bg-gray-100 border-gray-400 text-gray-800">グレー</option>
                      </select>
                      <button
                        onClick={addCondition}
                        className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        病名を追加
                      </button>
                    </div>
                  </div>

                  {/* 既存の病名一覧 */}
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {conditions.map(condition => (
                      <div key={condition.code} className={`p-3 rounded border flex justify-between items-center ${condition.color}`}>
                        <div>
                          <div className="font-medium text-sm">{condition.name}</div>
                          <div className="text-xs text-gray-600">コード: {condition.code} | 記号: {condition.symbol}</div>
                        </div>
                        <button
                          onClick={() => deleteCondition(condition.code)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 治療法設定 */}
                <div>
                  <h3 className="text-lg font-bold mb-3">治療法マスター</h3>
                  
                  {/* 新しい治療法追加 */}
                  <div className="border rounded-lg p-4 mb-4 bg-gray-50">
                    <h4 className="font-medium mb-2">新しい治療法を追加</h4>
                    <div className="space-y-2">
                      <select
                        value={newTreatment.conditionCode}
                        onChange={(e) => setNewTreatment(prev => ({ ...prev, conditionCode: e.target.value }))}
                        className="w-full px-3 py-2 border rounded text-sm"
                      >
                        <option value="">対象病名を選択</option>
                        {conditions.map(condition => (
                          <option key={condition.code} value={condition.code}>
                            {condition.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="治療名（例：レジン充填）"
                        value={newTreatment.name}
                        onChange={(e) => setNewTreatment(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                      
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-medium">治療ステップ</label>
                          <button
                            onClick={addStep}
                            className="text-blue-500 hover:text-blue-700 text-sm"
                          >
                            + ステップ追加
                          </button>
                        </div>
                        {newTreatment.steps.map((step, index) => (
                          <div key={index} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              placeholder={`ステップ ${index + 1}`}
                              value={step}
                              onChange={(e) => {
                                const newSteps = [...newTreatment.steps];
                                newSteps[index] = e.target.value;
                                setNewTreatment(prev => ({ ...prev, steps: newSteps }));
                              }}
                              className="flex-1 px-3 py-2 border rounded text-sm"
                            />
                            {newTreatment.steps.length > 1 && (
                              <button
                                onClick={() => removeStep(index)}
                                className="text-red-500 hover:text-red-700 text-sm px-2"
                              >
                                削除
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      <button
                        onClick={addTreatment}
                        className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                      >
                        治療法を追加
                      </button>
                    </div>
                  </div>

                  {/* 既存の治療法一覧 */}
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {Object.entries(treatmentRules).map(([conditionCode, treatments]) => (
                      <div key={conditionCode} className="border rounded-lg p-3">
                        <h4 className="font-bold text-sm mb-2">
                          {conditions.find(c => c.code === conditionCode)?.name || conditionCode}
                          {treatments.length > 1 && (
                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                              複数治療あり（1番目がデフォルト）
                            </span>
                          )}
                        </h4>
                        <div className="space-y-2">
                          {treatments.map((treatment, index) => (
                            <div key={index} className={`bg-white p-2 rounded border flex justify-between items-center ${
                              index === 0 ? 'border-green-400 bg-green-50' : 'border-gray-200'
                            }`}>
                              <div className="flex items-center gap-2 flex-1">
                                <div className="flex flex-col">
                                  <button
                                    onClick={() => index > 0 && moveTreatment(conditionCode, index, index - 1)}
                                    disabled={index === 0}
                                    className={`text-xs px-1 ${index === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'}`}
                                    title="上に移動"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    onClick={() => index < treatments.length - 1 && moveTreatment(conditionCode, index, index + 1)}
                                    disabled={index === treatments.length - 1}
                                    className={`text-xs px-1 ${index === treatments.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'}`}
                                    title="下に移動"
                                  >
                                    ↓
                                  </button>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                                      {index + 1}
                                    </span>
                                    <div className="font-medium text-sm">{treatment.name}</div>
                                    {index === 0 && (
                                      <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">
                                        デフォルト
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    {treatment.steps.join(' → ')} ({treatment.duration}回)
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => deleteTreatment(conditionCode, index)}
                                className="text-red-500 hover:text-red-700 text-xs ml-2 px-2 py-1"
                              >
                                削除
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center mt-6 pt-4 border-t">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                >
                  設定を閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DentalWorkflowApp;