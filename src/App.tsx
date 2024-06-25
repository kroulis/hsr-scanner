import { Button, Chip, Input, Skeleton } from '@nextui-org/react';
import cv from '@techstark/opencv-js';
import clsx from 'clsx';
import { Minus, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import { createWorker, Worker } from 'tesseract.js';

import ShouldLockRulesList from '@/components/ShouldLockRulesList.tsx';
import ValuableSubList from '@/components/ValuableSubList.tsx';
import useRelicStore from '@/store/relicStore.ts';
import ImageUtils from '@/utils/imageUtils.ts';
import OcrUtils from '@/utils/ocrUtils.ts';
import relicUtils from '@/utils/relicUtils.ts';

import './App.css';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  const [worker, setWorker] = useState<Worker | null>(null);

  const {
    relicTitle,
    setRelicTitle,
    mainRelicStats,
    setMainRelicStats,

    subRelicStats,
    setSubRelicStats,

    relicRatingInfo,
    fetchRelicRatingInfo,
    setRelicRatingInfo,
  } = useRelicStore();

  const titlePartRef = React.useRef<HTMLCanvasElement>(null);
  const mainStatsPartRef = React.useRef<HTMLCanvasElement>(null);
  const subStatsPartRef = React.useRef<HTMLCanvasElement>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null);
  const [workerInitialized, setWorkerInitialized] = useState(false);
  const [scanningStatus, setScanningStatus] = useState(false);
  const [scanningInterval, setScanningInterval] = useState<number>(2000);

  const [imageCapturedShowed, setImageCapturedShowed] = useState(false);
  const [floatingWindowShowed, setFloatingWindowShowed] = useState(false);

  const [mainRelicStatsError, setMainRelicStatsError] = useState<string | null>(null);
  const [subRelicStatsError, setSubRelicStatsError] = useState<string | null>(null);

  const [absoluteScore, setAbsoluteScore] = useState('');
  const [isMostValuableRelic, setIsMostValuableRelic] = useState(false);
  const [isValuableRelic, setIsValuableRelic] = useState(false);
  const [isValuableMainStats, setIsValuableMainStats] = useState(false);
  const [isValuableSubStats, setIsValuableSubStats] = useState<{
    [index: number]: boolean;
  }>({
    1: false,
    2: false,
    3: false,
    4: false,
  });

  useEffect(() => {
    // Initialize the worker
    const initializeWorker = async () => {
      const newWorker = await createWorker('eng');
      setWorker(newWorker);
      setWorkerInitialized(true);
    };

    initializeWorker();

    return () => {
      // Terminate the worker when component unmounts
      worker?.terminate();
    };
  }, []);

  useEffect(() => {
    // make sure the worker is initialized
    if (!workerInitialized) {
      return;
    }

    // if the scanning is started, then start the interval
    if (!scanningStatus) {
      return;
    }

    const interval = setInterval(async () => {
      await captureScreen();
    }, scanningInterval);

    return () => clearInterval(interval);
  }, [currentImage, workerInitialized, scanningInterval, scanningStatus]);

  useEffect(() => {
    fetchRelicRatingInfo().then(result => {
      setRelicRatingInfo(result);
    });
  }, [relicTitle, mainRelicStats, fetchRelicRatingInfo, setRelicRatingInfo]);

  useEffect(() => {
    (window as any).ipcRenderer.send('message-to-floating-window', {
      type: 'relic-info',
      data: {
        relicTitle: relicTitle,
        mainRelicStats: mainRelicStats,
        subRelicStats: subRelicStats,
        absoluteScore: absoluteScore,
        isMostValuableRelic: isMostValuableRelic,
        isValuableRelic: isValuableRelic,
        isValuableMainStats: isValuableMainStats,
        isValuableSubStats: isValuableSubStats,
      },
    });
  }, [
    absoluteScore,
    isMostValuableRelic,
    isValuableMainStats,
    isValuableRelic,
    isValuableSubStats,
    mainRelicStats,
    relicTitle,
    subRelicStats,
  ]);

  useEffect(() => {
    setIsMostValuableRelic(false);
    setIsValuableRelic(false);
    setIsValuableMainStats(false);
    setIsValuableSubStats({
      1: false,
      2: false,
      3: false,
      4: false,
    });

    if (!relicRatingInfo) {
      return;
    }

    let maxAbsoluteScore = 0;
    let minAbsoluteScore = 0;
    if (mainRelicStatsError || subRelicStatsError || !mainRelicStats || subRelicStats.length == 0) {
      return;
    }

    // The relic can have 3-4 sub stats at level 0, each 3 levels will increase the score by 1
    const maxScore = mainRelicStats.level == 0 ? 4 : Math.floor(mainRelicStats.level / 3) + 4;

    // Calculate the current relic score
    for (let i = 0; i < subRelicStats.length; i++) {
      const subStat = subRelicStats[i];
      // the spd can have multiple scores
      if (subStat.score instanceof Array) {
        const maxScore = Math.max(...subStat.score);
        const minScore = Math.min(...subStat.score);
        maxAbsoluteScore += maxScore;
        minAbsoluteScore += minScore;
      } else {
        maxAbsoluteScore += Number(subStat.score);
        minAbsoluteScore += Number(subStat.score);
      }
    }

    maxAbsoluteScore = parseFloat(maxAbsoluteScore.toFixed(2));
    minAbsoluteScore = parseFloat(minAbsoluteScore.toFixed(2));

    let absoluteScore = '';

    if (minAbsoluteScore == maxAbsoluteScore) {
      absoluteScore = `${maxAbsoluteScore} / ${maxScore}`;
    } else {
      absoluteScore = `${minAbsoluteScore} - ${maxAbsoluteScore} / ${maxScore}`;
    }

    setAbsoluteScore(absoluteScore);
    setIsValuableMainStats(true);

    const configValuableSubStats = relicRatingInfo.valuableSub;
    const configShouldLockStats = relicRatingInfo.shouldLock;

    // extract the name from the subRelicStats
    const subStatsList = subRelicStats.map(stat => stat.name);

    // label the valuable sub stats
    const labeledSubStats = relicUtils.labelValuableSubStats(configValuableSubStats, subStatsList);

    // check if the relic is the most valuable relic
    if (
      relicUtils.isMostValuableRelic(
        configShouldLockStats,
        subStatsList,
        Object.values(labeledSubStats).filter(val => val).length
      )
    ) {
      setIsMostValuableRelic(true);
    }

    setIsValuableSubStats(labeledSubStats);

    // if the valuable sub stats is more than 1, then the relic is valuable
    if (Object.values(labeledSubStats).filter(val => val).length >= 1) {
      setIsValuableRelic(true);
    } else {
      setIsValuableRelic(false);
    }
  }, [mainRelicStats, mainRelicStatsError, relicRatingInfo, subRelicStats, subRelicStatsError]);

  const resetAttributes = () => {
    setAbsoluteScore('');
    setRelicTitle('');
    setMainRelicStats(null);
    setSubRelicStats([]);
    setMainRelicStatsError(null);
    setSubRelicStatsError(null);
    setRelicRatingInfo(null);
  };

  const captureScreen = async () => {
    const res = await (window as any).ipcRenderer.captureScreen();
    
    const croppedImage = res.crop({
      x: 1400,
      y: 0,
      width: 445,
      height: 800,
    });

    // if the image is not changed, do not process it
    if (currentImage && currentImage == croppedImage.toDataURL()) {
      console.log('Image not changed');
      return;
    }

    setIsLoaded(false);
    // reset the stats
    resetAttributes();
    setCurrentImage(croppedImage);

    try {
      // source image
      const imgGray = await ImageUtils.img2MatGray(croppedImage.toDataURL());
      const imgRGB = await ImageUtils.img2MatRGB(croppedImage.toDataURL());

      // anything above the trash icon should contain the relic title
      const relicTitleRGB = ImageUtils.matCrop(imgRGB, 0, 100, 445, 70);

      // anything below the trash icon should contain the relic stats
      const relicMainStatsRGB = ImageUtils.matCrop(imgRGB, 0, 392, 445, 50);

      // anything below the relic stats should contain the relic sub stats
      const relicSubStatsRGB = ImageUtils.matCrop(imgRGB, 0, 442, 445, 358);

      // convert each part to HSV
      const relicTitleHSV = new cv.Mat();
      cv.cvtColor(relicTitleRGB, relicTitleHSV, cv.COLOR_RGB2HSV);

      const relicMainStatsHSV = new cv.Mat();
      cv.cvtColor(relicMainStatsRGB, relicMainStatsHSV, cv.COLOR_RGB2HSV);

      const relicSubStatsHSV = new cv.Mat();
      cv.cvtColor(relicSubStatsRGB, relicSubStatsHSV, cv.COLOR_RGB2HSV);

      // apply mask to each part
      const maskedRelicTitle = ImageUtils.applyFilter(relicTitleHSV, relicTitleRGB);
      const maskedRelicMainStats = ImageUtils.applyFilter(relicMainStatsHSV, relicMainStatsRGB);
      const maskedRelicSubStats = ImageUtils.applyFilter(relicSubStatsHSV, relicSubStatsRGB);

      // make sure the work in initialized
      if (worker) {
        if (titlePartRef.current) {
          cv.imshow(titlePartRef.current, maskedRelicTitle);
          const relicTitleOCRResult = await OcrUtils.relicTitleExtractor(worker, titlePartRef.current.toDataURL());
          setRelicTitle(relicTitleOCRResult);
        }

        if (mainStatsPartRef.current) {
          cv.imshow(mainStatsPartRef.current, maskedRelicMainStats);
          const relicMainStatsOCRResult = await OcrUtils.relicMainStatsExtractor(
            worker,
            mainStatsPartRef.current.toDataURL()
          );

          if (relicMainStatsOCRResult.error) {
            setMainRelicStatsError(relicMainStatsOCRResult.error);
          }
          setMainRelicStats(relicMainStatsOCRResult.result[0]);
        }

        if (subStatsPartRef.current) {
          cv.imshow(subStatsPartRef.current, maskedRelicSubStats);
          const relicSubStatsOCRResult = await OcrUtils.relicSubStatsExtractor(
            worker,
            subStatsPartRef.current.toDataURL()
          );
          if (relicSubStatsOCRResult.error) {
            setSubRelicStatsError(relicSubStatsOCRResult.error);
          }
          setSubRelicStats(relicSubStatsOCRResult.result);
        }
      }

      // release the memory
      imgGray.delete();
      imgRGB.delete();
      relicTitleRGB.delete();
      relicMainStatsRGB.delete();
      relicSubStatsRGB.delete();
      relicTitleHSV.delete();
      relicMainStatsHSV.delete();
      relicSubStatsHSV.delete();
      maskedRelicTitle.delete();
      maskedRelicMainStats.delete();
      maskedRelicSubStats.delete();
    } catch (e) {
      console.error(e);
    }
    setIsLoaded(true);
  };

  const handleAddValuableMainStats = async () => {
    if (!relicTitle || !mainRelicStats) {
      toast('请先开始扫描遗器', { type: 'error' });
      return;
    }
    const result = await relicUtils.addRelicRatingValuableMain(relicTitle, mainRelicStats.name);
    await fetchRelicRatingInfo();
    if (result.success) {
      setIsValuableMainStats(true);
      toast(result.message, { type: 'success' });
    } else {
      toast(result.message, { type: 'error' });
    }
  };

  const handleRemoveValuableMainStats = async () => {
    if (!relicTitle || !mainRelicStats) {
      toast('请先开始扫描遗器', { type: 'error' });
      return;
    }
    const result = await relicUtils.removeRelicRatingValuableMain(relicTitle, mainRelicStats.name);
    await fetchRelicRatingInfo();
    if (result.success) {
      setIsValuableMainStats(false);
      toast(result.message, { type: 'success' });
    } else {
      toast(result.message, { type: 'error' });
    }
  };

  const handleToggleImageCaptured = () => {
    setImageCapturedShowed(!imageCapturedShowed);
  };

  const handleToggleFloatingWindow = async () => {
    if (floatingWindowShowed) {
      await (window as any).ipcRenderer.closeFloatingWindow();
    } else {
      await (window as any).ipcRenderer.openFloatingWindow();
    }
    setFloatingWindowShowed(!floatingWindowShowed);
  };

  return (
    <div>
      <ToastContainer />
      <div className={'flex min-h-full min-w-full flex-row justify-around gap-2 p-8 text-center'}>
        <div className={clsx(imageCapturedShowed ? 'w-1/2' : 'w-full')}>
          <div className={'flex flex-col justify-center gap-2'}>
            <div className={'flex justify-center gap-2'}>
              <Button
                onPress={() => {
                  setScanningStatus(!scanningStatus);
                }}
              >
                {scanningStatus ? '停止' : '开始'}扫描
              </Button>
              <Button onPress={handleToggleImageCaptured}>{imageCapturedShowed ? '隐藏' : '显示'}图像</Button>
              <Button onPress={handleToggleFloatingWindow}>{floatingWindowShowed ? '关闭' : '打开'}悬浮窗口</Button>
            </div>
            <div>
              <Input
                label={'扫描频率(ms):'}
                type="number"
                value={scanningInterval.toString()}
                onChange={e => {
                  setScanningStatus(false);
                  setScanningInterval(Number(e.target.value));
                }}
              />
            </div>
          </div>

          <div className={'flex flex-row justify-center gap-2 p-2'}>
            <div className={'font-bold'}>{relicTitle}</div>
            {relicTitle && (
              <Chip color={isMostValuableRelic ? 'success' : isValuableRelic ? 'warning' : 'danger'}>
                {isMostValuableRelic ? '建议锁定' : isValuableRelic ? '可以保留' : '建议分解'}
              </Chip>
            )}
          </div>
          <div className={'flex justify-center gap-1'}>
            <span className="font-bold">遗器成长值:</span>
            <span className={'text-blue-500'}>{absoluteScore}</span>
          </div>
          <div className={'font-bold'}>主属性:</div>
          <Skeleton isLoaded={isLoaded} className={'h-24'}>
            {mainRelicStatsError || !mainRelicStats ? (
              <div className="my-2 text-red-700">{mainRelicStatsError}</div>
            ) : (
              <div className="border-2 shadow">
                <div
                  className={clsx(
                    {
                      isValuable: isValuableMainStats,
                      isNotValuable: !isValuableMainStats,
                    },
                    'flex justify-center gap-1'
                  )}
                >
                  <span className="font-bold">{mainRelicStats.name}</span>:
                  <span className="text-blue-500">{mainRelicStats.number}</span>
                  <span className="font-bold">等级:</span>
                  <span className="text-blue-500">{mainRelicStats.level}</span>
                </div>
                {isValuableMainStats ? (
                  <div className="my-2">
                    <Button
                      startContent={<Minus />}
                      variant="flat"
                      color="danger"
                      onPress={handleRemoveValuableMainStats}
                    >
                      移除有效主属性
                    </Button>
                  </div>
                ) : (
                  <div className="my-2">
                    <Button startContent={<Plus />} variant="flat" color="success" onPress={handleAddValuableMainStats}>
                      添加为有效主属性
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Skeleton>
          <div className={'font-bold'}>副属性:</div>
          <Skeleton isLoaded={isLoaded} className="h-24">
            {subRelicStatsError || subRelicStats.length === 0 ? (
              <div className="my-2 text-red-700">{subRelicStatsError}</div>
            ) : (
              <div className="border-2 shadow">
                {subRelicStats.map((stat, index) => (
                  <div
                    key={index}
                    className={clsx(
                      {
                        isValuable: isValuableSubStats[index + 1],
                        isNotValuable: !isValuableSubStats[index + 1],
                      },
                      'flex justify-center gap-2'
                    )}
                  >
                    <div className="flex gap-1">
                      <span className="font-bold">{stat.name}</span>:
                      <span className="text-blue-500">{stat.number}</span>
                    </div>
                    <div className="flex gap-1">
                      <span className="font-bold">评分:</span>
                      <span className="text-blue-500">
                        {Array.isArray(stat.score) ? stat.score.join(' | ') : stat.score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Skeleton>
          <div className={'mt-2 flex flex-row justify-around gap-2'}>
            <ValuableSubList />
            <ShouldLockRulesList />
          </div>
        </div>
        <div
          className={clsx(
            {
              hidden: !imageCapturedShowed,
            },
            'flex w-1/2 flex-col items-center justify-center gap-2'
          )}
        >
          <div>图像捕获</div>
          <canvas ref={titlePartRef} />
          <canvas ref={mainStatsPartRef} />
          <canvas ref={subStatsPartRef} />
        </div>
      </div>
    </div>
  );
}

export default App;
