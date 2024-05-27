import React from 'react'; // Ensure React is imported for JSX
import {Badge} from '@mui/material';
import './Valuable.css';
import {Add, Clear} from "@mui/icons-material";

interface IValuableSubListProps {
    relicTitle: string;
    valuableSubStats: string[];
    setValuableSubStats: (valuableSubStats: string[]) => void;
}


const ValuableSubList: React.FC<IValuableSubListProps> = ({valuableSubStats, setValuableSubStats, relicTitle}) => {

    const handleRemoveItem = async (index: number) => {

        const newSubStats = valuableSubStats.filter((_, idx) => idx !== index);
        setValuableSubStats(newSubStats);
        // update the user's valuable relic sub stats
        const relicRating = await (window as any).ipcRenderer.storeGet(`data.relicRating.${relicTitle}`)
        relicRating['validSub'] = newSubStats
        const result = await (window as any).ipcRenderer.storeSet(`data.relicRating.${relicTitle}`, relicRating)
        console.log(result)
    }


    return (
        <div>
            <div className={"valuableSubTitle"}>valuable Relic Sub Stats:</div>
            <div className="valuableSubListContainer">
                {
                    valuableSubStats.length === 0 && <Badge color="primary" className="valuableSubStat">
                        No valuable sub stats
                    </Badge>
                }
                {valuableSubStats.map((subStat, index) => (
                    <Badge key={index} color="primary" className="valuableSubStat">
                        {subStat}
                        <Clear onClick={() => handleRemoveItem(index)} className={"valuableClearIcon"}/>
                    </Badge>
                ))}
                <Add onClick={() => setValuableSubStats([...valuableSubStats, "New Sub Stat"])}
                     className={"valuableAddIcon"}/>
            </div>
        </div>
    );
}

export default ValuableSubList;
