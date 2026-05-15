import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const getQuote = async (symbol: string) => {
  const response = await api.get(`/api/quote/${symbol}`);
  return response.data;
};

export const getOptionChain = async (symbol: string, expiry?: string) => {
  const response = await api.get(`/api/options/chain/${symbol}`, {
    params: { expiry }
  });
  return response.data;
};

export const getBars = async (symbol: string, days: number = 30) => {
  const response = await api.get(`/api/stock/bars/${symbol}`, {
    params: { days }
  });
  return response.data;
};

export const getOptionLevels = async (symbol: string, expiry?: string) => {
  const response = await api.get(`/api/options/levels/${symbol}`, {
    params: { expiry }
  });
  return response.data;
};

export const getGammaProfile = async (symbol: string, expiry?: string) => {
  const response = await api.get(`/api/options/gamma-profile/${symbol}`, {
    params: { expiry }
  });
  return response.data;
};

export const getTermStructure = async (symbol: string) => {
  const response = await api.get(`/api/options/term-structure/${symbol}`);
  return response.data;
};

export const chatWithGemini = async (query: string, context: any) => {
  const response = await api.post('/api/chat', null, {
    params: { query },
    data: context
  });
  return response.data;
};

export default api;
