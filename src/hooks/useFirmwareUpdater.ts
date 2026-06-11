import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface UpdateResult {
  miner: string;
  ipAddress: string;
  success: boolean;
  message?: string;
  error?: string;
}

export function useFirmwareUpdater() {
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState<{ [key: string]: string }>({});

  const updateFirmware = async (
    miners: Array<{ id: string; name: string; ip_address: string; model: string }>,
    firmwareUrl: string,
    model: string
  ): Promise<UpdateResult[]> => {
    setUpdating(true);
    setProgress({});

    try {
      const { data, error } = await supabase.functions.invoke('update-miner-firmware', {
        body: {
          miners: miners.map(m => ({ name: m.name, ipAddress: m.ip_address })),
          firmwareUrl,
          model,
        },
      });

      if (error) throw error;
      
      const results = data?.results || [];
      
      // Show results
      const successCount = results.filter((r: UpdateResult) => r.success).length;
      const failCount = results.length - successCount;
      
      if (successCount > 0) {
        toast.success(`${successCount} miner(s) updated successfully`);
      }
      
      if (failCount > 0) {
        toast.error(`${failCount} miner(s) failed to update`);
      }

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Update failed';
      toast.error(errorMessage);
      throw error;
    } finally {
      setUpdating(false);
      setProgress({});
    }
  };

  const checkForUpdates = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-firmware-updates');

      if (error) throw error;

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check updates';
      toast.error(errorMessage);
      throw error;
    }
  };

  const setMinerProgress = (minerId: string, message: string) => {
    setProgress(prev => ({
      ...prev,
      [minerId]: message,
    }));
  };

  return {
    updating,
    progress,
    updateFirmware,
    checkForUpdates,
    setMinerProgress,
  };
}