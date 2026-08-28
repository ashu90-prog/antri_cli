export interface Episode {
  id: string;
  timestamp: number;
  sessionId: string;
  query: string;
  response: string;
  toolsUsed: string[];
  debateStages?: string[];
  tags: string[];
}

export interface SemanticVectorItem {
  id: string;
  timestamp: number;
  text: string;
  category: 'problem_solution' | 'architecture_insight' | 'api_guide' | 'lesson_learned' | 'domain_knowledge';
  vector: number[];
  metadata: {
    sourceQuery?: string;
    workspace?: string;
    tags?: string[];
    confidence?: number;
  };
}

export interface UserProfileMemory {
  userName?: string;
  preferredLanguage?: string;
  codeStyle?: {
    indentation?: string;
    typingStrictness?: string;
    testFramework?: string;
  };
  preferredModels?: string[];
  customRules: string[];
  totalSessions: number;
  totalQueries: number;
  lastConsolidatedAt?: number;
}

export interface RecalledContext {
  episodes: Episode[];
  semanticInsights: SemanticVectorItem[];
  workspaceConventions: string[];
  userPreferences: string[];
  hasMemories: boolean;
}
