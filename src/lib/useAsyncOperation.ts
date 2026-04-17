import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

interface AsyncOptions {
  onError?: (error: any) => void;
  onSuccess?: () => void;
  showLoading?: boolean;
  loadingMessage?: string;
}

export const useAsyncOperation = (options: AsyncOptions = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const execute = useCallback(
    async <T,>(asyncFn: () => Promise<T>): Promise<T | null> => {
      setIsLoading(true);
      setError(null);
      const loadingToast = options.showLoading ? toast.loading(options.loadingMessage || 'Loading...') : undefined;
      
      try {
        const result = await asyncFn();
        if (loadingToast) toast.dismiss(loadingToast);
        options.onSuccess?.();
        return result;
      } catch (err: any) {
        const errorMsg = err.message || 'An error occurred';
        setError(errorMsg);
        if (loadingToast) {
          toast.error(errorMsg, { id: loadingToast });
        } else {
          toast.error(errorMsg);
        }
        options.onError?.(err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );
  
  return { isLoading, error, execute };
};